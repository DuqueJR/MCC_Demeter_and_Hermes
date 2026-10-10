#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include <linux/media/raspberrypi/pisp_fe_statistics.h>
#include <unistd.h>

#include <nlohmann/json.hpp>

#include "ipa/rpi/controller/awb_status.h"
#include "ipa/rpi/controller/awb_algorithm.h"
#include "ipa/rpi/controller/black_level_status.h"
#include "ipa/rpi/controller/cac_status.h"
#include "ipa/rpi/controller/alsc_status.h"
#include "ipa/rpi/controller/camera_mode.h"
#include "ipa/rpi/controller/ccm_status.h"
#include "ipa/rpi/controller/contrast_status.h"
#include "ipa/rpi/controller/controller.h"
#include "ipa/rpi/controller/denoise_status.h"
#include "ipa/rpi/controller/device_status.h"
#include "ipa/rpi/controller/dpc_status.h"
#include "ipa/rpi/controller/geq_status.h"
#include "ipa/rpi/controller/lux_status.h"
#include "ipa/rpi/controller/metadata.h"
#include "ipa/rpi/controller/noise_status.h"
#include "ipa/rpi/controller/sharpen_status.h"
#include "ipa/rpi/controller/statistics.h"

#include "helpers/backend_device.hpp"
#include "helpers/media_device.hpp"
#include "libpisp/backend/backend.hpp"
#include "libpisp/common/utils.hpp"
#include "libpisp/variants/variant.hpp"

using Json = nlohmann::json;
using namespace std::chrono_literals;

namespace
{

template<typename T>
T requireStatus(RPiController::Metadata &metadata, const char *key)
{
	T status{};
	if (metadata.get(key, status))
		throw std::runtime_error(std::string("Controller did not produce ") + key);
	return status;
}

int fixedField(double value, unsigned int bits, unsigned int fractional_bits, bool is_signed = false)
{
	const int64_t scale = int64_t{ 1 } << fractional_bits;
	const int64_t minimum = is_signed ? -(int64_t{ 1 } << (bits - 1)) : 0;
	const int64_t maximum = (int64_t{ 1 } << (bits - (is_signed ? 1 : 0))) - 1;
	return static_cast<int>(std::clamp<int64_t>(std::llround(value * scale), minimum, maximum));
}

bool finite(const AwbStatus &status)
{
	return std::isfinite(status.temperatureK) && std::isfinite(status.gainR) &&
	       std::isfinite(status.gainG) && std::isfinite(status.gainB) &&
	       status.gainR > 0 && status.gainG > 0 && status.gainB > 0;
}

double bilinear(const std::vector<double> &table, unsigned int source_width, unsigned int source_height,
		unsigned int x, unsigned int y, unsigned int target_width, unsigned int target_height)
{
	const double source_x = target_width > 1
				 ? -0.5 + static_cast<double>(source_width) * x / (target_width - 1)
				 : 0;
	const double source_y = target_height > 1
				 ? -0.5 + static_cast<double>(source_height) * y / (target_height - 1)
				 : 0;
	const int x0_raw = static_cast<int>(std::floor(source_x));
	const int y0_raw = static_cast<int>(std::floor(source_y));
	const double xf = source_x - x0_raw;
	const double yf = source_y - y0_raw;
	const unsigned int x0 = std::clamp(x0_raw, 0, static_cast<int>(source_width) - 1);
	const unsigned int y0 = std::clamp(y0_raw, 0, static_cast<int>(source_height) - 1);
	const unsigned int x1 = std::min(x0_raw + 1, static_cast<int>(source_width) - 1);
	const unsigned int y1 = std::min(y0_raw + 1, static_cast<int>(source_height) - 1);
	const auto at = [&](unsigned int sx, unsigned int sy) { return table[sy * source_width + sx]; };
	const double upper = at(x0, y0) * (1.0 - xf) + at(x1, y0) * xf;
	const double lower = at(x0, y1) * (1.0 - xf) + at(x1, y1) * xf;
	return upper * (1.0 - yf) + lower * yf;
}

void applyLensShading(libpisp::BackEnd &backend, const AlscStatus &status, uint16_t width, uint16_t height)
{
	constexpr unsigned int grid_size = PISP_BE_LSC_GRID_SIZE;
	constexpr unsigned int vertices = grid_size + 1;
	const unsigned int source_width = 32;
	const unsigned int source_height = 32;
	if (status.r.size() != source_width * source_height || status.g.size() != status.r.size() ||
	    status.b.size() != status.r.size())
		throw std::runtime_error("ALSC table does not match the PiSP pisp 32x32 grid");

	pisp_be_lsc_config lsc = {};
	for (unsigned int y = 0; y < vertices; ++y)
	{
		for (unsigned int x = 0; x < vertices; ++x)
		{
			const std::array<double, 3> rgb = {
				bilinear(status.r, source_width, source_height, x, y, vertices, vertices),
				bilinear(status.g, source_width, source_height, x, y, vertices, vertices),
				bilinear(status.b, source_width, source_height, x, y, vertices, vertices)
			};
			const double lo = std::min({ rgb[0], rgb[1], rgb[2] });
			const double hi = std::max({ rgb[0], rgb[1], rgb[2] });
			unsigned int range;
			double scale;
			double offset;
			if (lo >= 0.5 && hi < 1.5)
			{
				range = 0;
				scale = 1024.0;
				offset = -511.5;
			}
			else if (hi < 2.0)
			{
				range = 1;
				scale = 512.0;
				offset = 0.5;
			}
			else if (hi < 4.0)
			{
				range = 2;
				scale = 256.0;
				offset = 0.5;
			}
			else
			{
				range = 3;
				scale = 128.0;
				offset = 0.5;
			}
			const uint32_t red = fixedField(offset + scale * rgb[0], 10, 0);
			const uint32_t green = fixedField(offset + scale * rgb[1], 10, 0);
			const uint32_t blue = fixedField(offset + scale * rgb[2], 10, 0);
			lsc.lut_packed[y][x] = (range << 30) | (blue << 20) | (green << 10) | red;
		}
	}
	backend.SetLsc(lsc);
	(void)width;
	(void)height;
}

void applyChromaticAberration(libpisp::BackEnd &backend, const CacStatus &status)
{
	constexpr unsigned int vertices = PISP_BE_CAC_GRID_SIZE + 1;
	if (status.lutRx.size() != vertices * vertices || status.lutRy.size() != vertices * vertices ||
	    status.lutBx.size() != vertices * vertices || status.lutBy.size() != vertices * vertices)
		throw std::runtime_error("CAC LUT dimensions do not match the PiSP pisp 9x9 grid");

	pisp_be_cac_config cac = {};
	for (unsigned int y = 0; y < vertices; ++y)
	{
		for (unsigned int x = 0; x < vertices; ++x)
		{
			const unsigned int index = y * vertices + x;
			cac.lut[y][x][0][0] = fixedField(status.lutRx[index], 7, 5, true);
			cac.lut[y][x][0][1] = fixedField(status.lutRy[index], 7, 5, true);
			cac.lut[y][x][1][0] = fixedField(status.lutBx[index], 7, 5, true);
			cac.lut[y][x][1][1] = fixedField(status.lutBy[index], 7, 5, true);
		}
	}
	backend.SetCac(cac);
}

void validateStatuses(RPiController::Metadata &metadata, const libcamera::Size &awb_grid, Json &output)
{
	const auto awb = requireStatus<AwbStatus>(metadata, "awb.status");
	const auto ccm = requireStatus<CcmStatus>(metadata, "ccm.status");
	const auto alsc = requireStatus<AlscStatus>(metadata, "alsc.status");
	const auto cac = requireStatus<CacStatus>(metadata, "cac.status");
	const auto contrast = requireStatus<ContrastStatus>(metadata, "contrast.status");
	const auto sharpen = requireStatus<SharpenStatus>(metadata, "sharpen.status");
	const auto sdn = requireStatus<SdnStatus>(metadata, "sdn.status");
	const auto cdn = requireStatus<CdnStatus>(metadata, "cdn.status");
	const auto noise = requireStatus<NoiseStatus>(metadata, "noise.status");
	const auto lux = requireStatus<LuxStatus>(metadata, "lux.status");
	const auto black_level = requireStatus<BlackLevelStatus>(metadata, "black_level.status");
	const auto dpc = requireStatus<DpcStatus>(metadata, "dpc.status");
	const auto geq = requireStatus<GeqStatus>(metadata, "geq.status");

	if (!finite(awb) || !contrast.gammaCurve.size() || alsc.r.size() != awb_grid.width * awb_grid.height ||
	    alsc.g.size() != alsc.r.size() || alsc.b.size() != alsc.r.size() ||
	    cac.lutRx.size() != cac.lutRy.size() ||
	    cac.lutBx.size() != cac.lutBy.size())
		throw std::runtime_error("Controller produced incomplete or invalid image statuses");

	for (double value : ccm.matrix)
		if (!std::isfinite(value))
			throw std::runtime_error("CCM contains a non-finite coefficient");
	for (const auto *table : { &alsc.r, &alsc.g, &alsc.b, &cac.lutRx, &cac.lutRy, &cac.lutBx, &cac.lutBy })
		for (double value : *table)
			if (!std::isfinite(value))
				throw std::runtime_error("Calibration status contains a non-finite value");

	output["awb"] = Json{ { "mode", std::string(awb.mode, strnlen(awb.mode, sizeof(awb.mode))) },
			      { "temperature_k", awb.temperatureK }, { "gain_r", awb.gainR },
			      { "gain_g", awb.gainG }, { "gain_b", awb.gainB } };
	output["lux"] = lux.lux;
	output["ccm"] = ccm.matrix;
	output["alsc"] = Json{ { "rows", awb_grid.height }, { "cols", awb_grid.width },
				 { "entries", alsc.r.size() } };
	output["alsc"]["green_gain"] = alsc.g;
	output["cac_entries"] = cac.lutRx.size();
	output["gamma_curve_points"] = contrast.gammaCurve.size();
	output["sharpen"] = { { "threshold", sharpen.threshold }, { "strength", sharpen.strength },
			       { "limit", sharpen.limit } };
	output["sdn"] = { { "noise_constant", sdn.noiseConstant }, { "noise_slope", sdn.noiseSlope },
			   { "strength", sdn.strength } };
	output["cdn"] = { { "threshold", cdn.threshold }, { "strength", cdn.strength } };
	output["noise"] = { { "constant", noise.noiseConstant }, { "slope", noise.noiseSlope } };
	output["black_level_tuned"] = { black_level.blackLevelR, black_level.blackLevelG,
					 black_level.blackLevelB };
	output["dpc_strength"] = dpc.strength;
	output["geq"] = { { "offset", geq.offset }, { "slope", geq.slope } };
}

uint32_t gammaEntry(const libcamera::ipa::Pwl &curve, size_t index)
{
	const size_t next_index = index + 1;
	int next_x;
	if (next_index < 32)
		next_x = next_index * 512;
	else if (next_index < 48)
		next_x = (next_index - 32) * 1024 + 16384;
	else
		next_x = (next_index - 48) * 2048 + 32768;

	static thread_local int previous_y = 0;
	if (index == 0)
		previous_y = static_cast<int>(curve.eval(0));
	const int y = previous_y;
	const int next_y = static_cast<int>(curve.eval(next_x));
	const unsigned int slope = std::min<unsigned int>(std::max(0, next_y - y), (1u << 14) - 1);
	previous_y = y + slope;
	return (static_cast<uint32_t>(std::clamp(y, 0, 65535)) & 0xffff) | (slope << 16);
}

uint16_t adjustedBlackLevel(uint16_t sensor_level, int bayer16_offset, int cfe_offset)
{
	return static_cast<uint16_t>(std::clamp<int>(sensor_level + bayer16_offset - cfe_offset, 0, 65535));
}

/* Levels are in the tune's 16-bit sensor domain (IMX708 tune black_level = 4096). */
struct DevelopOptions
{
	std::optional<uint16_t> black_level;
	std::optional<uint32_t> white_level;
	std::optional<std::pair<double, double>> fixed_awb_gains;
	int bayer16_offset = 0;
};

void applyControllerStates(libpisp::BackEnd &backend, const Json &frame_metadata,
			   RPiController::Metadata &metadata, uint16_t width, uint16_t height,
			   const DevelopOptions &options, Json &status_output)
{
	const int bayer16_offset = options.bayer16_offset;
	pisp_be_global_config global = {};
	backend.GetGlobal(global);
	global.bayer_order = PISP_BAYER_ORDER_BGGR;
	global.bayer_enables |= PISP_BE_BAYER_ENABLE_INPUT | PISP_BE_BAYER_ENABLE_DEMOSAIC |
				PISP_BE_BAYER_ENABLE_WBG;
	global.rgb_enables |= PISP_BE_RGB_ENABLE_OUTPUT0 | PISP_BE_RGB_ENABLE_CCM |
			      PISP_BE_RGB_ENABLE_GAMMA;

	const auto black_status = requireStatus<BlackLevelStatus>(metadata, "black_level.status");
	const uint16_t tune_black_r = options.black_level.value_or(black_status.blackLevelR);
	const uint16_t tune_black_g = options.black_level.value_or(black_status.blackLevelG);
	const uint16_t tune_black_b = options.black_level.value_or(black_status.blackLevelB);

	/* BLC only subtracts, so white_level rescales so that it lands where full scale (65535) lands by default. */
	double white_scale = 1.0;
	if (options.white_level)
	{
		const double black_ref = std::min({ tune_black_r, tune_black_g, tune_black_b });
		if (*options.white_level <= black_ref || *options.white_level > 65535)
			throw std::runtime_error("white_level must be above the black level and at most 65535");
		white_scale = (65535.0 - black_ref) / (*options.white_level - black_ref);
	}

	const auto awb = requireStatus<AwbStatus>(metadata, "awb.status");
	const double digital_gain = frame_metadata.value("digital_gain", 1.0) * white_scale;
	const double minimum_gain = std::min({ awb.gainR, awb.gainG, awb.gainB, 1.0 });
	const double extra_gain = 1.0 / std::max(minimum_gain, 0.1);
	pisp_wbg_config wbg = {};
	wbg.gain_r = fixedField(digital_gain * awb.gainR * extra_gain, 14, 10);
	wbg.gain_g = fixedField(digital_gain * awb.gainG * extra_gain, 14, 10);
	wbg.gain_b = fixedField(digital_gain * awb.gainB * extra_gain, 14, 10);
	backend.SetWbg(wbg);

	const int cfe_offset = frame_metadata.value("cfe_compression_offset", 2048);
	const uint16_t black_r = adjustedBlackLevel(tune_black_r, bayer16_offset, cfe_offset);
	const uint16_t black_g = adjustedBlackLevel(tune_black_g, bayer16_offset, cfe_offset);
	const uint16_t black_b = adjustedBlackLevel(tune_black_b, bayer16_offset, cfe_offset);
	pisp_bla_config black = {};
	black.black_level_r = black_r;
	black.black_level_gr = black_g;
	black.black_level_gb = black.black_level_gr;
	black.black_level_b = black_b;
	black.output_black_level = 0;
	backend.SetBlc(black);
	global.bayer_enables |= PISP_BE_BAYER_ENABLE_BLC;
	status_output["bayer16_decompression_offset"] = bayer16_offset;
	status_output["cfe_compression_offset"] = cfe_offset;
	status_output["black_level_effective"] = { black_r, black_g, black_b };
	status_output["black_level_used"] = { tune_black_r, tune_black_g, tune_black_b };
	status_output["white_level"] = options.white_level ? Json(*options.white_level) : Json(65535);
	status_output["white_scale"] = white_scale;

	const auto ccm_status = requireStatus<CcmStatus>(metadata, "ccm.status");
	pisp_be_ccm_config ccm = {};
	for (unsigned int i = 0; i < 9; ++i)
		ccm.coeffs[i] = fixedField(ccm_status.matrix[i], 14, 10, true);
	backend.SetCcm(ccm);

	const auto dpc_status = requireStatus<DpcStatus>(metadata, "dpc.status");
	pisp_be_dpc_config dpc = {};
	if (dpc_status.strength == 1)
	{
		dpc.coeff_level = 1;
		dpc.coeff_range = 8;
		global.bayer_enables |= PISP_BE_BAYER_ENABLE_DPC;
	}
	else if (dpc_status.strength == 2)
	{
		dpc.coeff_level = 0;
		dpc.coeff_range = 0;
		global.bayer_enables |= PISP_BE_BAYER_ENABLE_DPC;
	}
	backend.SetDpc(dpc);

	const auto geq_status = requireStatus<GeqStatus>(metadata, "geq.status");
	pisp_be_geq_config geq = {};
	geq.min = 0;
	geq.max = 0xffff;
	geq.offset = geq_status.offset;
	geq.slope_sharper = fixedField(geq_status.slope, 10, 10);
	backend.SetGeq(geq);
	global.bayer_enables |= PISP_BE_BAYER_ENABLE_GEQ;

	const auto alsc_status = requireStatus<AlscStatus>(metadata, "alsc.status");
	applyLensShading(backend, alsc_status, width, height);
	global.bayer_enables |= PISP_BE_BAYER_ENABLE_LSC;

	const auto cac_status = requireStatus<CacStatus>(metadata, "cac.status");
	applyChromaticAberration(backend, cac_status);
	global.bayer_enables |= PISP_BE_BAYER_ENABLE_CAC;

	const auto noise_status = requireStatus<NoiseStatus>(metadata, "noise.status");
	const auto sdn_status = requireStatus<SdnStatus>(metadata, "sdn.status");
	pisp_be_sdn_config sdn = {};
	sdn.black_level = 0;
	sdn.leakage = fixedField(1.0 - sdn_status.strength, 8, 8);
	sdn.noise_constant = fixedField(sdn_status.noiseConstant, 16, 0);
	sdn.noise_slope = fixedField(sdn_status.noiseSlope, 16, 8);
	sdn.noise_constant2 = fixedField(sdn_status.noiseConstant2, 16, 0);
	sdn.noise_slope2 = fixedField(sdn_status.noiseSlope2, 16, 8);
	backend.SetSdn(sdn);
	global.bayer_enables |= PISP_BE_BAYER_ENABLE_SDN;
	(void)noise_status;

	const auto cdn_status = requireStatus<CdnStatus>(metadata, "cdn.status");
	pisp_be_cdn_config cdn = {};
	cdn.thresh = fixedField(cdn_status.threshold, 16, 0);
	cdn.iir_strength = fixedField(cdn_status.strength, 8, 8);
	backend.SetCdn(cdn);
	global.bayer_enables |= PISP_BE_BAYER_ENABLE_CDN;

	const auto sharpen_status = requireStatus<SharpenStatus>(metadata, "sharpen.status");
	pisp_be_sh_fc_combine_config sharpen_combine = {};
	pisp_be_sharpen_config sharpen = {};
	backend.InitialiseSharpen(sharpen, sharpen_combine);
	const double threshold_scale = sharpen_status.threshold * 0.25;
	sharpen.threshold_offset0 = fixedField(sharpen.threshold_offset0 * threshold_scale, 16, 0);
	sharpen.threshold_offset1 = fixedField(sharpen.threshold_offset1 * threshold_scale, 16, 0);
	sharpen.threshold_offset2 = fixedField(sharpen.threshold_offset2 * threshold_scale, 16, 0);
	sharpen.threshold_offset3 = fixedField(sharpen.threshold_offset3 * threshold_scale, 16, 0);
	sharpen.threshold_offset4 = fixedField(sharpen.threshold_offset4 * threshold_scale, 16, 0);
	sharpen.threshold_slope0 = fixedField(sharpen.threshold_slope0 * threshold_scale, 12, 0);
	sharpen.threshold_slope1 = fixedField(sharpen.threshold_slope1 * threshold_scale, 12, 0);
	sharpen.threshold_slope2 = fixedField(sharpen.threshold_slope2 * threshold_scale, 12, 0);
	sharpen.threshold_slope3 = fixedField(sharpen.threshold_slope3 * threshold_scale, 12, 0);
	sharpen.threshold_slope4 = fixedField(sharpen.threshold_slope4 * threshold_scale, 12, 0);
	sharpen.positive_strength = fixedField(sharpen.positive_strength * sharpen_status.strength, 12, 0);
	sharpen.negative_strength = fixedField(sharpen.negative_strength * sharpen_status.strength, 12, 0);
	sharpen.positive_pre_limit = fixedField(sharpen.positive_pre_limit * sharpen_status.limit, 16, 0);
	sharpen.positive_limit = fixedField(sharpen.positive_limit * sharpen_status.limit, 16, 0);
	sharpen.negative_pre_limit = fixedField(sharpen.negative_pre_limit * sharpen_status.limit, 16, 0);
	sharpen.negative_limit = fixedField(sharpen.negative_limit * sharpen_status.limit, 16, 0);
	backend.SetSharpen(sharpen);
	global.rgb_enables |= PISP_BE_RGB_ENABLE_SHARPEN;

	const auto contrast = requireStatus<ContrastStatus>(metadata, "contrast.status");
	pisp_be_gamma_config gamma = {};
	for (size_t i = 0; i < PISP_BE_GAMMA_LUT_SIZE; ++i)
		gamma.lut[i] = gammaEntry(contrast.gammaCurve, i);
	backend.SetGamma(gamma);

	pisp_image_format_config input = {};
	input.width = width;
	input.height = height;
	input.format = libpisp::get_pisp_image_format("BAYER16");
	libpisp::compute_optimal_stride(input);
	backend.SetInputFormat(input);

	pisp_be_output_format_config output = {};
	output.image.width = width;
	output.image.height = height;
	output.image.format = libpisp::get_pisp_image_format("RGB888");
	libpisp::compute_optimal_stride(output.image, true);
	backend.SetOutputFormat(0, output);
	backend.SetCrop(0, { 0, 0, width, height });
	backend.SetSmartResize(0, { width, height });
	backend.SetGlobal(global);
}

std::vector<uint8_t> readExact(const std::string &path, size_t expected_size)
{
	std::ifstream in(path, std::ios::binary | std::ios::ate);
	if (!in)
		throw std::runtime_error("Cannot open " + path);
	if (static_cast<size_t>(in.tellg()) != expected_size)
		throw std::runtime_error("Unexpected file size for " + path);
	in.seekg(0);
	std::vector<uint8_t> bytes(expected_size);
	in.read(reinterpret_cast<char *>(bytes.data()), bytes.size());
	if (!in)
		throw std::runtime_error("Short read from " + path);
	return bytes;
}

void runBackend(const pisp_be_tiles_config &tiles, const std::string &bayer_path,
		uint16_t width, uint16_t height, const std::string &output_path)
{
	libpisp::helpers::MediaDevice devices;
	const std::string media = devices.Acquire();
	if (media.empty())
		throw std::runtime_error("No PiSP BE media device is available");

	libpisp::helpers::BackendDevice device(media);
	if (!device.Valid())
		throw std::runtime_error("Failed to open PiSP BE device");
	device.Setup(tiles);
	auto buffers = device.GetBufferSlice();

	pisp_image_format_config input = {};
	input.width = width;
	input.height = height;
	input.format = libpisp::get_pisp_image_format("BAYER16");
	libpisp::compute_optimal_stride(input);
	const auto bayer = readExact(bayer_path, static_cast<size_t>(input.stride) * height);

	{
		libpisp::helpers::Buffer::Sync sync(buffers.at("pispbe-input"),
						   libpisp::helpers::Buffer::Sync::Access::ReadWrite);
		for (unsigned int y = 0; y < height; ++y)
			std::memcpy(sync.Get()[0] + y * input.stride,
				    bayer.data() + static_cast<size_t>(y) * input.stride, input.stride);
	}

	if (device.Run(buffers))
		throw std::runtime_error("PiSP BE job failed");

	pisp_image_format_config output = {};
	output.width = width;
	output.height = height;
	output.format = libpisp::get_pisp_image_format("RGB888");
	libpisp::compute_optimal_stride(output, true);
	std::ofstream out(output_path, std::ios::binary);
	if (!out)
		throw std::runtime_error("Cannot open BE output file");
	{
		libpisp::helpers::Buffer::Sync sync(buffers.at("pispbe-output0"),
						   libpisp::helpers::Buffer::Sync::Access::Read);
		for (unsigned int y = 0; y < height; ++y)
			out.write(reinterpret_cast<const char *>(sync.Get()[0] + y * output.stride), width * 3);
	}
	if (!out)
		throw std::runtime_error("Failed to write BE output");
}

} // namespace

int main(int argc, char **argv)
{
	std::vector<std::string> positional;
	std::string config_path;
	DevelopOptions options;
	try
	{
		for (int i = 1; i < argc; ++i)
		{
			const std::string arg = argv[i];
			auto value = [&]() -> std::string {
				if (i + 1 >= argc)
					throw std::runtime_error("Missing value for " + arg);
				return argv[++i];
			};
			if (arg == "--config")
				config_path = value();
			else if (arg == "--bayer16-offset")
				options.bayer16_offset = std::stoi(value());
			else if (arg == "--black-level")
				options.black_level = static_cast<uint16_t>(std::stoul(value()));
			else if (arg == "--white-level")
				options.white_level = static_cast<uint32_t>(std::stoul(value()));
			else if (arg.rfind("--", 0) == 0)
				throw std::runtime_error("Unknown argument " + arg);
			else
				positional.push_back(arg);
		}
		if (positional.size() != 5)
			throw std::runtime_error("expected 5 positional arguments");
	}
	catch (const std::exception &error)
	{
		std::cerr << "controller_replay: " << error.what() << "\n"
			  << "Usage: controller_replay <pisp_stats.bin> <capture.json> <imx708.json> <bayer16.raw> <output-prefix>\n"
			  << "       [--config resolved.json] [--bayer16-offset N] [--black-level N] [--white-level N]\n";
		return 2;
	}

	try
	{
		const std::string stats_path = positional[0];
		const std::string metadata_path = positional[1];
		const std::string tuning_path = positional[2];
		const std::string bayer_path = positional[3];
		const std::string output_prefix = positional[4];
		if (!config_path.empty())
		{
			std::ifstream config_in(config_path);
			if (!config_in)
				throw std::runtime_error("Cannot open config " + config_path);
			const Json profile = Json::parse(config_in);
			const Json develop = profile.value("develop", Json::object());
			/* Command-line values win over the profile. */
			if (!options.black_level && develop.contains("black_level") && develop["black_level"].is_number())
				options.black_level = develop["black_level"].get<uint16_t>();
			if (!options.white_level && develop.contains("white_level") && develop["white_level"].is_number())
				options.white_level = develop["white_level"].get<uint32_t>();
			const Json wb = profile.value("white_balance", Json::object());
			if (wb.value("mode", "auto") == "fixed")
				options.fixed_awb_gains = std::make_pair(wb.at("gains").at(0).get<double>(),
									 wb.at("gains").at(1).get<double>());
		}
		const Json frame_metadata = Json::parse(std::ifstream(metadata_path));
		const uint16_t width = frame_metadata.at("width").get<uint16_t>();
		const uint16_t height = frame_metadata.at("height").get<uint16_t>();
		const auto stats_bytes = readExact(stats_path, sizeof(pisp_statistics));
		pisp_statistics pisp_stats = {};
		std::memcpy(&pisp_stats, stats_bytes.data(), sizeof(pisp_stats));

		auto statistics = std::make_shared<RPiController::Statistics>(
			RPiController::Statistics::AgcStatsPos::PostWb,
			RPiController::Statistics::ColourStatsPos::PreLsc);
		std::array<uint32_t, PISP_AGC_STATS_NUM_BINS> histogram{};
		std::memcpy(histogram.data(), pisp_stats.agc.histogram, sizeof(pisp_stats.agc.histogram));
		statistics->yHist = RPiController::Histogram(histogram.data(), histogram.size());
		statistics->awbRegions.init({ PISP_AWB_STATS_SIZE, PISP_AWB_STATS_SIZE });
		for (unsigned int i = 0; i < PISP_AWB_STATS_NUM_ZONES; ++i)
		{
			const auto &zone = pisp_stats.awb.zones[i];
			statistics->awbRegions.set(i, { { zone.R_sum, zone.G_sum, zone.B_sum, 0 }, zone.counted, 0 });
		}
		statistics->agcRegions.init({ 0, 0 }, PISP_FLOATING_STATS_NUM_ZONES);
		for (unsigned int i = 0; i < PISP_FLOATING_STATS_NUM_ZONES; ++i)
		{
			const auto &zone = pisp_stats.agc.floating[i];
			statistics->agcRegions.setFloating(i, { { 0, 0, 0, zone.Y_sum }, zone.counted, 0 });
		}
		statistics->focusRegions.init({ PISP_CDAF_STATS_SIZE, PISP_CDAF_STATS_SIZE });
		for (unsigned int i = 0; i < PISP_CDAF_STATS_NUM_FOMS; ++i)
			statistics->focusRegions.set(i, { pisp_stats.cdaf.foms[i] >> 20, 0, 0 });

		Json tuning = Json::parse(std::ifstream(tuning_path));
		Json filtered_algorithms = Json::array();
		for (const auto &entry : tuning.at("algorithms"))
		{
			if (entry.contains("rpi.agc") || entry.contains("rpi.af") || entry.contains("rpi.sync"))
				continue;
			filtered_algorithms.push_back(entry);
		}
		tuning["algorithms"] = std::move(filtered_algorithms);
		const std::string filtered_tuning_path = "/tmp/demeter-controller-tuning-" +
			std::to_string(getpid()) + ".json";
		{
			std::ofstream filtered(filtered_tuning_path);
			filtered << tuning.dump(2);
		}

		RPiController::Controller controller;
		if (controller.read(filtered_tuning_path.c_str()))
			throw std::runtime_error("Controller rejected the filtered IMX708 tune");
		controller.initialise();
		auto *awb_algorithm = dynamic_cast<RPiController::AwbAlgorithm *>(controller.getAlgorithm("awb"));
		if (!awb_algorithm)
			throw std::runtime_error("Filtered tune did not register rpi.awb");
		awb_algorithm->setMode("auto");
		if (options.fixed_awb_gains)
			awb_algorithm->setManualGains(options.fixed_awb_gains->first, options.fixed_awb_gains->second);

		CameraMode mode = {};
		mode.bitdepth = 10;
		mode.width = width;
		mode.height = height;
		mode.sensorWidth = width;
		mode.sensorHeight = height;
		mode.binX = mode.binY = 1;
		mode.scaleX = mode.scaleY = 1.0;
		mode.noiseFactor = 1.0;
		mode.transform = libcamera::Transform::Identity;
		mode.sensitivity = 1.0;
		mode.minLineLength = 1us;
		mode.maxLineLength = 1us;
		mode.minFrameDuration = 1s / 30;
		mode.maxFrameDuration = 1s;
		mode.minFrameLength = height;
		mode.maxFrameLength = height * 2;
		mode.pixelRate = 1;
		mode.minExposureTime = 1us;
		mode.maxExposureTime = 1s;
		mode.minAnalogueGain = 1.0;
		mode.maxAnalogueGain = 16.0;

		RPiController::Metadata metadata;
		DeviceStatus device_status;
		device_status.exposureTime = std::chrono::microseconds(
			frame_metadata.value("exposure_time_us", int64_t{ 10000 }));
		device_status.analogueGain = frame_metadata.value("analogue_gain", 1.0);
		device_status.aperture = 1.0;
		metadata.set("device.status", device_status);
		controller.switchMode(mode, &metadata);

		for (unsigned int frame = 0; frame < 64; ++frame)
		{
			controller.process(statistics, &metadata);
			controller.prepare(&metadata);
			std::this_thread::sleep_for(1ms);
		}

		Json result = { { "frame_sequence", frame_metadata.at("frame_sequence") },
				{ "controller_target", controller.getTarget() },
				{ "stats_bytes", stats_bytes.size() },
				{ "replayed_controller_frames", 64 } };
		validateStatuses(metadata, controller.getHardwareConfig().awbRegions, result);
		/* AwbStatus::mode is left uninitialised when the gains are manual. */
		result["awb"]["mode"] = options.fixed_awb_gains ? "fixed" : "auto";

		const auto &variant = libpisp::BCM2712_D0;
		libpisp::BackEnd backend(libpisp::BackEnd::Config{}, variant);
		applyControllerStates(backend, frame_metadata, metadata, width, height, options, result);
		pisp_be_tiles_config tiles = {};
		backend.Prepare(&tiles);

		{
			std::ofstream config_out(output_prefix + ".be.json");
			if (!config_out)
				throw std::runtime_error("Cannot open BE config output");
			config_out << backend.GetJsonConfig(&tiles);
		}
		const std::string rgb_output_path = output_prefix + ".rgb888.raw";
		runBackend(tiles, bayer_path, width, height, rgb_output_path);
		result["backend_config_valid"] = true;
		result["backend_output"] = rgb_output_path;
		std::ofstream status_out(output_prefix + ".status.json");
		if (!status_out)
			throw std::runtime_error("Cannot open Controller status output");
		status_out << result.dump(2) << '\n';
		std::cout << result.dump(2) << '\n';
	}
	catch (const std::exception &error)
	{
		std::cerr << "controller_replay: " << error.what() << '\n';
		return 1;
	}

	return 0;
}
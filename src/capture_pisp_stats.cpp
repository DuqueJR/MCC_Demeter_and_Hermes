#include <algorithm>
#include <array>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <sys/ioctl.h>
#include <sys/mman.h>

#include <linux/dma-buf.h>
#include <linux/media/raspberrypi/pisp_fe_statistics.h>

#include <libcamera/camera_manager.h>
#include <libcamera/control_ids.h>
#include <libcamera/framebuffer_allocator.h>
#include <libcamera/libcamera.h>

#include <nlohmann/json.hpp>

using namespace libcamera;
using Json = nlohmann::json;

namespace
{

class RequestWaiter : public Object
{
public:
	void completed(Request *request)
	{
		std::lock_guard<std::mutex> lock(mutex_);
		if (request->status() == Request::RequestComplete)
			done_.push_back(request);
		condition_.notify_one();
	}

	Request *wait(std::chrono::seconds timeout)
	{
		std::unique_lock<std::mutex> lock(mutex_);
		condition_.wait_for(lock, timeout, [&] { return !done_.empty(); });
		if (done_.empty())
			return nullptr;
		Request *request = done_.front();
		done_.pop_front();
		return request;
	}

private:
	std::mutex mutex_;
	std::condition_variable condition_;
	std::deque<Request *> done_;
};

class CameraCleanup
{
public:
	explicit CameraCleanup(std::shared_ptr<Camera> camera)
		: camera_(std::move(camera))
	{
	}

	~CameraCleanup()
	{
		if (started_)
			camera_->stop();
		if (acquired_)
			camera_->release();
	}

	void setAcquired() { acquired_ = true; }
	void setStarted() { started_ = true; }
	void stopCamera()
	{
		if (started_)
		{
			camera_->stop();
			started_ = false;
		}
	}

private:
	std::shared_ptr<Camera> camera_;
	bool acquired_ = false;
	bool started_ = false;
};

int32_t lookup(const std::map<std::string, int32_t> &table, const std::string &name, const char *what)
{
	const auto it = table.find(name);
	if (it == table.end())
		throw std::runtime_error(std::string("Unknown ") + what + ": " + name);
	return it->second;
}

/* Camera behaviour requested by the mission profile; applied identically on every request. */
struct Settings
{
	bool ae_manual = false;
	int32_t shutter_us = 0;
	float analogue_gain = 1.0f;
	int32_t exposure_mode = controls::ExposureNormal;
	int32_t metering_mode = controls::MeteringCentreWeighted;
	int32_t constraint_mode = controls::ConstraintNormal;
	float ev = 0.0f;

	bool awb_fixed = false;
	std::array<float, 2> colour_gains = { 1.0f, 1.0f };

	int32_t af_mode = controls::AfModeManual;
	int32_t af_range = controls::AfRangeFull;
	std::optional<float> lens_position;
	bool af_trigger = false;

	void apply(ControlList &list, bool first) const
	{
		list.set(controls::rpi::StatsOutputEnable, true);
		if (ae_manual)
		{
			list.set(controls::ExposureTimeMode, controls::ExposureTimeModeManual);
			list.set(controls::ExposureTime, shutter_us);
			list.set(controls::AnalogueGainMode, controls::AnalogueGainModeManual);
			list.set(controls::AnalogueGain, analogue_gain);
		}
		else
		{
			list.set(controls::ExposureTimeMode, controls::ExposureTimeModeAuto);
			list.set(controls::AnalogueGainMode, controls::AnalogueGainModeAuto);
			list.set(controls::AeExposureMode, exposure_mode);
			list.set(controls::AeMeteringMode, metering_mode);
			list.set(controls::AeConstraintMode, constraint_mode);
			list.set(controls::ExposureValue, ev);
		}
		if (awb_fixed)
		{
			list.set(controls::AwbEnable, false);
			list.set(controls::ColourGains, Span<const float, 2>(colour_gains));
		}
		else
		{
			list.set(controls::AwbEnable, true);
		}
		list.set(controls::AfMode, af_mode);
		list.set(controls::AfRange, af_range);
		if (lens_position)
			list.set(controls::LensPosition, *lens_position);
		if (first && af_trigger)
			list.set(controls::AfTrigger, controls::AfTriggerStart);
	}
};

Settings parseSettings(const Json &config)
{
	static const std::map<std::string, int32_t> exposure_modes = {
		{ "normal", controls::ExposureNormal }, { "short", controls::ExposureShort },
		{ "long", controls::ExposureLong }
	};
	static const std::map<std::string, int32_t> metering_modes = {
		{ "centre-weighted", controls::MeteringCentreWeighted }, { "spot", controls::MeteringSpot },
		{ "matrix", controls::MeteringMatrix }
	};
	static const std::map<std::string, int32_t> constraint_modes = {
		{ "normal", controls::ConstraintNormal }, { "highlight", controls::ConstraintHighlight },
		{ "shadows", controls::ConstraintShadows }
	};
	static const std::map<std::string, int32_t> af_ranges = {
		{ "normal", controls::AfRangeNormal }, { "macro", controls::AfRangeMacro },
		{ "full", controls::AfRangeFull }
	};

	Settings settings;
	const Json exposure = config.value("exposure", Json::object());
	if (exposure.value("mode", "auto") == "manual")
	{
		settings.ae_manual = true;
		settings.shutter_us = exposure.at("shutter_us").get<int32_t>();
		settings.analogue_gain = exposure.at("gain").get<float>();
	}
	else
	{
		settings.exposure_mode = lookup(exposure_modes, exposure.value("exposure_mode", "normal"), "exposure_mode");
		settings.metering_mode = lookup(metering_modes, exposure.value("metering", "centre-weighted"), "metering");
		settings.constraint_mode = lookup(constraint_modes, exposure.value("constraint", "normal"), "constraint");
		settings.ev = exposure.value("ev", 0.0f);
	}

	const Json wb = config.value("white_balance", Json::object());
	const std::string wb_mode = wb.value("mode", "auto");
	if (wb_mode == "fixed")
	{
		settings.awb_fixed = true;
		settings.colour_gains = { wb.at("gains").at(0).get<float>(), wb.at("gains").at(1).get<float>() };
		if (settings.colour_gains[0] <= 0 || settings.colour_gains[1] <= 0)
			throw std::runtime_error("white_balance.gains must be positive");
	}
	else if (wb_mode != "auto")
	{
		throw std::runtime_error("white_balance.mode must be resolved to 'auto' or 'fixed' (got '" + wb_mode + "')");
	}

	const Json focus = config.value("focus", Json::object());
	const std::string focus_mode = focus.value("mode", "infinity");
	settings.af_range = lookup(af_ranges, focus.value("range", "full"), "focus.range");
	if (focus_mode == "infinity")
	{
		settings.af_mode = controls::AfModeManual;
		settings.lens_position = 0.0f;
	}
	else if (focus_mode == "manual")
	{
		settings.af_mode = controls::AfModeManual;
		settings.lens_position = focus.at("lens_position").get<float>();
	}
	else if (focus_mode == "auto")
	{
		settings.af_mode = controls::AfModeAuto;
		settings.af_trigger = true;
	}
	else if (focus_mode == "continuous")
	{
		settings.af_mode = controls::AfModeContinuous;
	}
	else
	{
		throw std::runtime_error("focus.mode must be infinity, manual, auto or continuous");
	}
	return settings;
}

void syncDmaBuffer(int fd, uint64_t flags)
{
	dma_buf_sync sync = {};
	sync.flags = flags;
	if (ioctl(fd, DMA_BUF_IOCTL_SYNC, &sync) < 0)
		throw std::runtime_error("DMA_BUF_IOCTL_SYNC failed");
}

void writeRaw(const FrameBuffer &buffer, const std::string &path)
{
	const auto planes = buffer.planes();
	const auto metadata = buffer.metadata();
	if (planes.empty() || metadata.planes().empty())
		throw std::runtime_error("RAW frame has no memory plane");

	const auto &plane = planes[0];
	const size_t bytes_used = std::min<size_t>(metadata.planes()[0].bytesused, plane.length);
	if (!bytes_used)
		throw std::runtime_error("RAW frame is empty");

	syncDmaBuffer(plane.fd.get(), DMA_BUF_SYNC_START | DMA_BUF_SYNC_READ);
	void *mapping = mmap(nullptr, plane.length, PROT_READ, MAP_SHARED, plane.fd.get(), 0);
	if (mapping == MAP_FAILED)
	{
		syncDmaBuffer(plane.fd.get(), DMA_BUF_SYNC_END | DMA_BUF_SYNC_READ);
		throw std::runtime_error("Failed to map RAW buffer");
	}

	std::ofstream out(path, std::ios::binary);
	out.write(static_cast<const char *>(mapping), bytes_used);
	munmap(mapping, plane.length);
	syncDmaBuffer(plane.fd.get(), DMA_BUF_SYNC_END | DMA_BUF_SYNC_READ);
	if (!out)
		throw std::runtime_error("Failed to write RAW output");
}

void writeStats(const Request &request, const std::string &path)
{
	const auto stats = request.metadata().get(controls::rpi::PispStatsOutput);
	if (!stats)
		throw std::runtime_error("PispStatsOutput is missing; StatsOutputEnable may not be supported");
	if (stats->size() != sizeof(pisp_statistics))
		throw std::runtime_error("Unexpected PISP_FE_STATS size: " + std::to_string(stats->size()) +
					 " bytes, expected " + std::to_string(sizeof(pisp_statistics)));

	std::ofstream out(path, std::ios::binary);
	out.write(reinterpret_cast<const char *>(stats->data()), stats->size());
	if (!out)
		throw std::runtime_error("Failed to write FE statistics");
}

void writeMetadata(const Request &request, const StreamConfiguration &config, const Json &profile,
		   unsigned int camera_index, unsigned int settle_frames, const std::string &path)
{
	const auto &metadata = request.metadata();
	Json out = { { "frame_sequence", request.sequence() },
		     { "camera_index", camera_index },
		     { "settle_frames", settle_frames },
		     { "width", config.size.width },
		     { "height", config.size.height },
		     { "stride", config.stride },
		     { "pixel_format", config.pixelFormat.toString() },
		     { "cfe_compression_offset", 2048 },
		     { "pisp_statistics_bytes", sizeof(pisp_statistics) },
		     { "profile_applied", profile } };

	if (const auto v = metadata.get(controls::ExposureTime))
		out["exposure_time_us"] = *v;
	if (const auto v = metadata.get(controls::AnalogueGain))
		out["analogue_gain"] = *v;
	if (const auto v = metadata.get(controls::DigitalGain))
		out["digital_gain"] = *v;
	if (const auto v = metadata.get(controls::Lux))
		out["lux"] = *v;
	if (const auto v = metadata.get(controls::ColourTemperature))
		out["colour_temperature"] = *v;
	if (const auto v = metadata.get(controls::ColourGains))
		out["colour_gains"] = Json::array({ (*v)[0], (*v)[1] });
	if (const auto v = metadata.get(controls::LensPosition))
		out["lens_position"] = *v;
	if (const auto v = metadata.get(controls::AfState))
		out["af_state"] = *v;
	if (const auto v = metadata.get(controls::FocusFoM))
		out["focus_fom"] = *v;
	if (const auto v = metadata.get(controls::AeState))
		out["ae_state"] = *v;

	std::ofstream file(path);
	file << out.dump(2) << '\n';
	if (!file)
		throw std::runtime_error("Failed to write metadata output");
}

const char *kUsage = "Usage: capture_pisp_stats --out <prefix> [--camera N] [--config resolved.json] "
		     "[--settle-frames K] [--exposure-us X --gain G]\n";

} // namespace

int main(int argc, char **argv)
{
	unsigned int camera_index = 0;
	std::string prefix;
	std::string config_path;
	std::optional<unsigned int> settle_override;
	std::optional<int32_t> exposure_override;
	std::optional<float> gain_override;

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
			if (arg == "--camera")
				camera_index = std::stoul(value());
			else if (arg == "--out")
				prefix = value();
			else if (arg == "--config")
				config_path = value();
			else if (arg == "--settle-frames")
				settle_override = std::stoul(value());
			else if (arg == "--exposure-us")
				exposure_override = std::stoi(value());
			else if (arg == "--gain")
				gain_override = std::stof(value());
			else
				throw std::runtime_error("Unknown argument " + arg);
		}
		if (prefix.empty() || exposure_override.has_value() != gain_override.has_value())
			throw std::runtime_error("--out is required; --exposure-us and --gain go together");
	}
	catch (const std::exception &error)
	{
		std::cerr << "capture_pisp_stats: " << error.what() << "\n" << kUsage;
		return 2;
	}

	try
	{
		Json profile = Json::object();
		if (!config_path.empty())
		{
			std::ifstream in(config_path);
			if (!in)
				throw std::runtime_error("Cannot open config " + config_path);
			profile = Json::parse(in);
		}
		if (exposure_override)
			profile["exposure"] = { { "mode", "manual" }, { "shutter_us", *exposure_override },
						{ "gain", *gain_override } };
		const Settings settings = parseSettings(profile);
		if (settings.ae_manual && (settings.shutter_us <= 0 || settings.analogue_gain < 1.0f))
			throw std::runtime_error("Manual exposure must be positive and analogue gain must be >= 1");
		const unsigned int settle_frames = settle_override.value_or(
			profile.value("capture", Json::object()).value("settle_frames", 30u));

		CameraManager manager;
		if (manager.start())
			throw std::runtime_error("Failed to start CameraManager");

		const auto cameras = manager.cameras();
		if (camera_index >= cameras.size())
			throw std::runtime_error("Camera index is not available");
		auto camera = cameras[camera_index];
		CameraCleanup cleanup(camera);
		if (camera->acquire())
			throw std::runtime_error("Failed to acquire camera");
		cleanup.setAcquired();

		auto config = camera->generateConfiguration({ StreamRole::VideoRecording, StreamRole::Raw });
		if (!config || config->size() != 2)
			throw std::runtime_error("Failed to create video+RAW configuration");
		if (config->validate() == CameraConfiguration::Invalid || camera->configure(config.get()))
			throw std::runtime_error("Failed to configure video+RAW streams");

		Stream *video_stream = config->at(0).stream();
		Stream *raw_stream = config->at(1).stream();
		FrameBufferAllocator video_allocator(camera);
		FrameBufferAllocator raw_allocator(camera);
		if (video_allocator.allocate(video_stream) < 0 || video_allocator.buffers(video_stream).empty() ||
		    raw_allocator.allocate(raw_stream) < 0 || raw_allocator.buffers(raw_stream).empty())
			throw std::runtime_error("Failed to allocate video+RAW buffers");

		RequestWaiter waiter;
		camera->requestCompleted.connect(&waiter, &RequestWaiter::completed, ConnectionTypeDirect);

		/* Per-request controls arrive a frame too late for the first frames, so start with them too. */
		ControlList start_controls(controls::controls);
		settings.apply(start_controls, false);
		if (camera->start(&start_controls))
			throw std::runtime_error("Failed to start camera");
		cleanup.setStarted();

		std::vector<std::unique_ptr<Request>> requests;
		const auto &video_buffers = video_allocator.buffers(video_stream);
		const auto &raw_buffers = raw_allocator.buffers(raw_stream);
		for (size_t i = 0; i < std::min(video_buffers.size(), raw_buffers.size()); ++i)
		{
			auto request = camera->createRequest();
			if (!request)
				throw std::runtime_error("Failed to create camera request");
			settings.apply(request->controls(), i == 0);
			if (request->addBuffer(video_stream, video_buffers[i].get()) ||
			    request->addBuffer(raw_stream, raw_buffers[i].get()) || camera->queueRequest(request.get()))
				throw std::runtime_error("Failed to queue camera request");
			requests.push_back(std::move(request));
		}

		Request *final_request = nullptr;
		unsigned int completed_count = 0;
		while (!final_request)
		{
			Request *request = waiter.wait(std::chrono::seconds(10));
			if (!request)
				throw std::runtime_error("Timed out waiting for a completed frame");
			if (completed_count++ >= settle_frames)
			{
				final_request = request;
				break;
			}
			request->reuse(Request::ReuseBuffers);
			settings.apply(request->controls(), false);
			if (camera->queueRequest(request))
				throw std::runtime_error("Failed to requeue camera request");
		}

		FrameBuffer *raw_buffer = final_request->findBuffer(raw_stream);
		if (!raw_buffer)
			throw std::runtime_error("Completed request has no RAW buffer");

		writeRaw(*raw_buffer, prefix + ".raw");
		writeStats(*final_request, prefix + ".pisp_stats.bin");
		writeMetadata(*final_request, config->at(1), profile, camera_index, settle_frames, prefix + ".json");
		cleanup.stopCamera();

		std::cout << "Captured frame " << final_request->sequence() << " as " << config->at(1).pixelFormat
			  << " with " << sizeof(pisp_statistics) << " bytes of PISP_FE_STATS\n";
	}
	catch (const std::exception &error)
	{
		std::cerr << "capture_pisp_stats: " << error.what() << '\n';
		return 1;
	}

	return 0;
}

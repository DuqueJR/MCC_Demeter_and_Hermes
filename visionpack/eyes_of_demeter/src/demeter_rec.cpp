// Recorder dual RAW con libcamera: captura IMX708 en BGGR_PISP_COMP1 y guarda
// PISP_FE_STATS en chunks RAM. Empareja por SensorTimestamp y descarta el frame
// huérfano si ambos timestamps existen y el skew supera 50 ms a 10 FPS. SIGINT
// solicita cierre cooperativo; EINTR en escritura también detiene el recorder.
// Al salir, finaliza el chunk y cierra los streams como cierre de mejor esfuerzo.

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <csignal>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <exception>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

#include <linux/dma-buf.h>
#include <linux/media/raspberrypi/pisp_fe_statistics.h>

#include <libcamera/camera_manager.h>
#include <libcamera/control_ids.h>
#include <libcamera/formats.h>
#include <libcamera/framebuffer_allocator.h>
#include <libcamera/libcamera.h>

#include <nlohmann/json.hpp>

using namespace libcamera;
using Json = nlohmann::json;
using SteadyClock = std::chrono::steady_clock;
using namespace std::chrono_literals;

namespace
{

static_assert(std::atomic<bool>::is_always_lock_free,
	      "Signal handlers require lock-free atomic<bool>");

constexpr unsigned int kCameraCount = 2;
constexpr unsigned int kSensorFps = 10;
constexpr int64_t kFrameDurationUs = 1000000 / kSensorFps;
constexpr float kFlightLensPosition = 0.0f;
constexpr unsigned int kLossOfSignalFps = 4;
constexpr unsigned int kMaxTargetFps = kSensorFps;
/* Medio periodo de frame: más skew que esto implica frames distintos (pérdida), no desfase de sensor. */
constexpr uint64_t kFrameMismatchNs = kFrameDurationUs * 1000 / 2;
constexpr size_t kStatsBytes = sizeof(pisp_statistics);

std::atomic<bool> stop_requested{ false };

void handleSignal(int)
{
	stop_requested.store(true, std::memory_order_relaxed);
}

struct Options
{
	std::filesystem::path output_directory = "/mnt/ramcam";
	std::filesystem::path target_fps_file = "/mnt/ramcam/target_fps.txt";
	std::filesystem::path flight_telemetry_file = "/mnt/ramcam/current_telemetry.json";
	std::filesystem::path config_file;
	double chunk_seconds = 8.0;
	unsigned int max_target_fps = 2;
	struct CaptureSettings
	{
		int32_t exposure_mode = controls::ExposureNormal;
		int32_t metering_mode = controls::MeteringCentreWeighted;
		int32_t constraint_mode = controls::ConstraintNormal;
		std::string exposure_mode_name = "normal";
		std::string metering_mode_name = "centre-weighted";
		std::string constraint_mode_name = "normal";
		float ev = 0.0f;
		unsigned int settle_frames = 0;
	} capture;
	bool check_config = false;
	bool sync = true;
};

using CaptureSettings = Options::CaptureSettings;

CaptureSettings loadCaptureSettings(const std::filesystem::path &path)
{
	std::ifstream input(path);
	if (!input)
		throw std::runtime_error("Cannot open profile " + path.string());
	const Json profile = Json::parse(input);
	const Json exposure = profile.value("exposure", Json::object());
	if (exposure.value("mode", "auto") != "auto")
		throw std::runtime_error("demeter_rec requires automatic exposure; fixed exposure is unsupported");

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
	const auto lookup = [](const auto &modes, const std::string &name, const char *field) {
		const auto it = modes.find(name);
		if (it == modes.end())
			throw std::runtime_error(std::string("Unknown ") + field + ": " + name);
		return it->second;
	};

	CaptureSettings settings;
	settings.exposure_mode_name = exposure.value("exposure_mode", "normal");
	settings.metering_mode_name = exposure.value("metering", "centre-weighted");
	settings.constraint_mode_name = exposure.value("constraint", "normal");
	settings.exposure_mode = lookup(exposure_modes, settings.exposure_mode_name, "exposure_mode");
	settings.metering_mode = lookup(metering_modes, settings.metering_mode_name, "metering");
	settings.constraint_mode = lookup(constraint_modes, settings.constraint_mode_name, "constraint");
	settings.ev = exposure.value("ev", 0.0f);
	if (!std::isfinite(settings.ev) || settings.ev < -8.0f || settings.ev > 8.0f)
		throw std::runtime_error("exposure.ev must be finite and between -8 and 8");
	settings.settle_frames = profile.value("capture", Json::object()).value("settle_frames", 0u);
	if (settings.settle_frames > 300)
		throw std::runtime_error("capture.settle_frames must be between 0 and 300 sensor frames");
	return settings;
}

Options parseOptions(int argc, char **argv)
{
	Options options;
	for (int i = 1; i < argc; ++i)
	{
		const std::string argument = argv[i];
		auto value = [&]() -> std::string {
			if (i + 1 >= argc)
				throw std::runtime_error("Missing value for " + argument);
			return argv[++i];
		};

		if (argument == "--out")
			options.output_directory = value();
		else if (argument == "--target-fps-file")
			options.target_fps_file = value();
		else if (argument == "--telemetry-file")
			options.flight_telemetry_file = value();
		else if (argument == "--config")
			options.config_file = value();
		else if (argument == "--check-config")
			options.check_config = true;
		else if (argument == "--chunk-time")
			options.chunk_seconds = std::stod(value());
		else if (argument == "--max-target-fps")
			options.max_target_fps = static_cast<unsigned int>(std::stoul(value()));
		else if (argument == "--no-sync")
			options.sync = false;
		else if (argument == "--help" || argument == "-h")
		{
						std::cout << "Usage: demeter_rec [--config PROFILE.json] [--check-config] [--out DIR] "
									 "[--chunk-time SECONDS] [--max-target-fps 1-10] [--no-sync] "
				     "[--target-fps-file PATH] [--telemetry-file PATH]\n";
			std::exit(0);
		}
		else
			throw std::runtime_error("Unknown argument " + argument);
	}

	if (!(options.chunk_seconds > 0.0) || !std::isfinite(options.chunk_seconds))
		throw std::runtime_error("--chunk-time must be a finite positive number");
	if (options.max_target_fps == 0 || options.max_target_fps > kMaxTargetFps)
		throw std::runtime_error("--max-target-fps must be between 1 and 10");
	if (!options.config_file.empty())
		options.capture = loadCaptureSettings(options.config_file);
	if (options.check_config && options.config_file.empty())
		throw std::runtime_error("--check-config requires --config");

	return options;
}

void applyCaptureControls(ControlList &control_list, const CaptureSettings &settings)
{
	control_list.set(controls::ExposureTimeMode, controls::ExposureTimeModeAuto);
	control_list.set(controls::AnalogueGainMode, controls::AnalogueGainModeAuto);
	control_list.set(controls::AeExposureMode, settings.exposure_mode);
	control_list.set(controls::AeMeteringMode, settings.metering_mode);
	control_list.set(controls::AeConstraintMode, settings.constraint_mode);
	control_list.set(controls::ExposureValue, settings.ev);
	control_list.set(controls::AfMode, controls::AfModeManual);
	control_list.set(controls::AfRange, controls::AfRangeFull);
	control_list.set(controls::LensPosition, kFlightLensPosition);
}

void syncDmaBuffer(int fd, uint64_t flags)
{
	dma_buf_sync sync = {};
	sync.flags = flags;
	if (::ioctl(fd, DMA_BUF_IOCTL_SYNC, &sync) < 0)
		throw std::runtime_error("DMA_BUF_IOCTL_SYNC failed: " + std::string(std::strerror(errno)));
}

class DmaBufReadSync
{
public:
	explicit DmaBufReadSync(int fd)
		: fd_(fd)
	{
		syncDmaBuffer(fd_, DMA_BUF_SYNC_START | DMA_BUF_SYNC_READ);
		active_ = true;
	}

	~DmaBufReadSync()
	{
		if (active_)
			::ioctl(fd_, DMA_BUF_IOCTL_SYNC, &end_sync_);
	}

	void finish()
	{
		syncDmaBuffer(fd_, DMA_BUF_SYNC_END | DMA_BUF_SYNC_READ);
		active_ = false;
	}

private:
	int fd_;
	bool active_ = false;
	dma_buf_sync end_sync_ = { .flags = DMA_BUF_SYNC_END | DMA_BUF_SYNC_READ };
};

class MappedDmaBuffer
{
public:
	explicit MappedDmaBuffer(const FrameBuffer::Plane &plane)
		: fd_(plane.fd.get()), length_(plane.length)
	{
		if (fd_ < 0 || !length_)
			throw std::runtime_error("RAW DMA buffer has an invalid plane");
		mapping_ = ::mmap(nullptr, length_, PROT_READ, MAP_SHARED, fd_, 0);
		if (mapping_ == MAP_FAILED)
		{
			mapping_ = nullptr;
			throw std::runtime_error("mmap of RAW DMA buffer failed: " + std::string(std::strerror(errno)));
		}
	}

	~MappedDmaBuffer()
	{
		if (mapping_)
			::munmap(mapping_, length_);
	}

	MappedDmaBuffer(const MappedDmaBuffer &) = delete;
	MappedDmaBuffer &operator=(const MappedDmaBuffer &) = delete;

	int fd() const { return fd_; }
	const uint8_t *data() const { return static_cast<const uint8_t *>(mapping_); }
	size_t length() const { return length_; }

private:
	int fd_;
	size_t length_;
	void *mapping_ = nullptr;
};

struct Completion
{
	Request *request;
	unsigned int camera_index;
	Request::Status status;
};

class CompletionQueue : public Object
{
public:
	void registerRequest(Request *request, unsigned int camera_index)
	{
		std::lock_guard<std::mutex> lock(mutex_);
		owners_.emplace(request, camera_index);
	}

	void completed(Request *request)
	{
		std::lock_guard<std::mutex> lock(mutex_);
		const auto owner = owners_.find(request);
		if (owner != owners_.end())
			completed_.push_back({ request, owner->second, request->status() });
		condition_.notify_one();
	}

	bool waitFor(std::chrono::milliseconds timeout)
	{
		std::unique_lock<std::mutex> lock(mutex_);
		return condition_.wait_for(lock, timeout, [&] { return !completed_.empty(); });
	}

	std::deque<Completion> takeAll()
	{
		std::lock_guard<std::mutex> lock(mutex_);
		std::deque<Completion> result;
		result.swap(completed_);
		return result;
	}

private:
	std::mutex mutex_;
	std::condition_variable condition_;
	std::unordered_map<Request *, unsigned int> owners_;
	std::deque<Completion> completed_;
};

struct CameraState
{
	unsigned int index = 0;
	std::shared_ptr<Camera> camera;
	bool acquired = false;
	bool started = false;
	std::unique_ptr<CameraConfiguration> configuration;
	Stream *raw_stream = nullptr;
	std::unique_ptr<FrameBufferAllocator> raw_allocator;
	std::vector<std::unique_ptr<Request>> requests;
	std::unordered_map<const FrameBuffer *, std::unique_ptr<MappedDmaBuffer>> raw_mappings;

	void shutdown() noexcept
	{
		if (started)
		{
			camera->stop();
			started = false;
		}
		requests.clear();
		raw_mappings.clear();
		if (raw_allocator && raw_stream)
			raw_allocator->free(raw_stream);
		raw_allocator.reset();
		if (acquired)
		{
			camera->release();
			acquired = false;
		}
	}

	~CameraState()
	{
		shutdown();
	}
};

ControlList makeControls(unsigned int camera_index, bool sync, const CaptureSettings &settings)
{
	ControlList controls(controls::controls);
	controls.set(controls::rpi::StatsOutputEnable, true);
	controls.set(controls::FrameDurationLimits, { kFrameDurationUs, kFrameDurationUs });
	applyCaptureControls(controls, settings);
	if (sync)
	{
		controls.set(controls::rpi::SyncMode, camera_index == 0 ? controls::rpi::SyncModeServer
									  : controls::rpi::SyncModeClient);
		if (camera_index == 0)
			controls.set(controls::rpi::SyncFrames, 100);
	}
	return controls;
}

void validateFrameDuration(const CameraState &state)
{
	const auto &camera_controls = state.camera->controls();
	const auto control = camera_controls.find(&controls::FrameDurationLimits);
	if (control == camera_controls.end())
		throw std::runtime_error("Camera " + std::to_string(state.index) +
					 " does not advertise FrameDurationLimits");
	const int64_t minimum = control->second.min().get<int64_t>();
	const int64_t maximum = control->second.max().get<int64_t>();
	if (kFrameDurationUs < minimum || kFrameDurationUs > maximum)
		throw std::runtime_error("Camera " + std::to_string(state.index) +
					 " cannot be configured for 10 FPS");
}

void configureCamera(CameraState &state, std::shared_ptr<Camera> camera, const CaptureSettings &settings)
{
	state.camera = std::move(camera);
	if (state.camera->acquire())
		throw std::runtime_error("Failed to acquire camera " + std::to_string(state.index));
	state.acquired = true;
	validateFrameDuration(state);

	state.configuration = state.camera->generateConfiguration({ StreamRole::Raw });
	if (!state.configuration || state.configuration->size() != 1)
		throw std::runtime_error("Failed to generate RAW configuration for camera " +
					 std::to_string(state.index));

	StreamConfiguration &raw_config = state.configuration->at(0);
	raw_config.size = { 4608, 2592 };
	raw_config.pixelFormat = formats::BGGR_PISP_COMP1;

	if (state.configuration->validate() == CameraConfiguration::Invalid)
		throw std::runtime_error("Invalid stream configuration for camera " + std::to_string(state.index));
	if (raw_config.size.width != 4608 || raw_config.size.height != 2592 ||
	    raw_config.pixelFormat != formats::BGGR_PISP_COMP1)
		throw std::runtime_error("Camera " + std::to_string(state.index) +
					 " did not accept 4608x2592 BGGR_PISP_COMP1");
	if (state.camera->configure(state.configuration.get()))
		throw std::runtime_error("Failed to configure camera " + std::to_string(state.index));

	state.raw_stream = raw_config.stream();
	state.raw_allocator = std::make_unique<FrameBufferAllocator>(state.camera);
	if (state.raw_allocator->allocate(state.raw_stream) < 0)
		throw std::runtime_error("Failed to allocate RAW buffers for camera " + std::to_string(state.index));

	const auto &raw_buffers = state.raw_allocator->buffers(state.raw_stream);
	const size_t request_count = raw_buffers.size();
	if (!request_count)
		throw std::runtime_error("No stream buffers allocated for camera " + std::to_string(state.index));

	for (size_t i = 0; i < request_count; ++i)
	{
		auto request = state.camera->createRequest();
		if (!request)
			throw std::runtime_error("Failed to create request for camera " + std::to_string(state.index));
		if (request->addBuffer(state.raw_stream, raw_buffers[i].get()))
			throw std::runtime_error("Failed to attach RAW buffer for camera " + std::to_string(state.index));
		request->controls().set(controls::rpi::StatsOutputEnable, true);
		request->controls().set(controls::FrameDurationLimits, { kFrameDurationUs, kFrameDurationUs });
				applyCaptureControls(request->controls(), settings);
		state.requests.push_back(std::move(request));
	}

	for (const auto &buffer : raw_buffers)
	{
		const auto planes = buffer->planes();
		if (planes.size() != 1)
			throw std::runtime_error("Expected one RAW DMA plane for camera " + std::to_string(state.index));
		state.raw_mappings.emplace(buffer.get(), std::make_unique<MappedDmaBuffer>(planes[0]));
	}
}

class TargetFpsPoller
{
public:
	TargetFpsPoller(std::filesystem::path path, std::filesystem::path output_directory,
			unsigned int max_target_fps)
		: path_(std::move(path)), output_directory_(std::move(output_directory)),
		  max_target_fps_(max_target_fps), next_poll_(SteadyClock::time_point::min()),
		  target_fps_(std::min(kLossOfSignalFps, max_target_fps))
	{
	}

	unsigned int pollIfDue(SteadyClock::time_point now)
	{
		if (now < next_poll_)
			return target_fps_;
		next_poll_ = now + 500ms;
		const std::optional<unsigned int> valid = readValidTarget();
		unsigned int requested_fps = 0;
		if (valid)
		{
			last_valid_fps_ = *valid;
			requested_fps = *valid;
		}
		else
		{
			requested_fps = std::max(last_valid_fps_, kLossOfSignalFps);
		}
		target_fps_ = std::min(requested_fps, max_target_fps_);

		std::error_code space_error;
		const auto space = std::filesystem::space(output_directory_, space_error);
		if (!space_error && space.capacity > 0)
		{
			const uint64_t used = space.capacity - space.available;
			if (used * 10 >= space.capacity * 9)
				target_fps_ = 1;
			else if (used * 10 >= space.capacity * 8)
				target_fps_ = std::min(target_fps_, 2u);
		}
		return target_fps_;
	}

	unsigned int value() const { return target_fps_; }

private:
	std::optional<unsigned int> readValidTarget() const
	{
		struct stat attributes = {};
		if (::stat(path_.c_str(), &attributes) < 0)
			return std::nullopt;

		const auto now_system = std::chrono::system_clock::now().time_since_epoch();
		const auto file_mtime = std::chrono::seconds(attributes.st_mtim.tv_sec) +
				std::chrono::nanoseconds(attributes.st_mtim.tv_nsec);
		if (now_system - file_mtime > 2s)
			return std::nullopt;

		std::ifstream input(path_);
		unsigned int fps = 0;
		std::string extra;
		if (!(input >> fps) || (input >> extra) || fps == 0 || fps > kMaxTargetFps)
			return std::nullopt;
		return fps;
	}

	std::filesystem::path path_;
	std::filesystem::path output_directory_;
	unsigned int max_target_fps_;
	SteadyClock::time_point next_poll_;
	unsigned int last_valid_fps_ = 0;
	unsigned int target_fps_ = kLossOfSignalFps;
};

struct CameraFiles
{
	std::ofstream frames;
	std::ofstream stats;
	std::ofstream metadata;
};

struct ChunkCounts
{
	uint64_t frames_received = 0;
	uint64_t frames_received_failed = 0;
	uint64_t requests_cancelled = 0;
	uint64_t frames_saved = 0;
	uint64_t pairs_received = 0;
	uint64_t pairs_saved = 0;
	std::array<uint64_t, kCameraCount> camera_frames_saved{};
	std::array<uint64_t, kCameraCount> unpaired_frames_dropped{};
	uint64_t max_sensor_skew_ns = 0;
	std::array<uint64_t, kCameraCount> sync_ready_frames{};
};

class ChunkWriter
{
public:
	ChunkWriter(std::filesystem::path output_directory, double chunk_seconds, unsigned int initial_chunk = 1)
		: output_directory_(std::move(output_directory)), chunk_seconds_(chunk_seconds), chunk_index_(initial_chunk)
	{
		std::filesystem::create_directories(output_directory_);
		openChunk();
	}

	void recordReceived(Request::Status status)
	{
		if (status == Request::RequestComplete)
			++counts_.frames_received;
		else if (status == Request::RequestCancelled)
			++counts_.requests_cancelled;
		else
			++counts_.frames_received_failed;
	}

	bool appendFrame(const CameraState &camera, Request &request, uint64_t pair_index,
			unsigned int target_fps, uint64_t pair_skew_ns)
	{
		FrameBuffer *raw_buffer = request.findBuffer(camera.raw_stream);
		if (!raw_buffer)
			throw std::runtime_error("Completed request has no RAW buffer");

		const auto mapped = camera.raw_mappings.find(raw_buffer);
		if (mapped == camera.raw_mappings.end())
			throw std::runtime_error("Completed RAW buffer has no mmap mapping");
		const auto frame_metadata = raw_buffer->metadata();
		if (frame_metadata.planes().size() != 1)
			throw std::runtime_error("Completed RAW buffer has an unexpected plane count");
		const size_t bytes_used = frame_metadata.planes()[0].bytesused;
		if (!bytes_used || bytes_used > mapped->second->length())
			throw std::runtime_error("Completed RAW bytesused is zero or exceeds the mapped plane");

		CameraFiles &files = files_[camera.index];
		const uint64_t raw_offset = raw_bytes_written_[camera.index];
		    int frame_write_error = 0;
		    {
			DmaBufReadSync sync(mapped->second->fd());
			    errno = 0;
			files.frames.write(reinterpret_cast<const char *>(mapped->second->data()),
					   static_cast<std::streamsize>(bytes_used));
			    if (!files.frames)
				    frame_write_error = errno ? errno : EIO;
			sync.finish();
		}
		if (!files.frames)
		    {
			    if (frame_write_error == EINTR)
				    stop_requested.store(true, std::memory_order_relaxed);
			    if (stop_requested.load(std::memory_order_relaxed) || frame_write_error == EINTR)
			    {
				    files.frames.clear();
				    return false;
			    }
			    throw std::runtime_error("Failed writing COMP1 frame data: " +
						     std::string(std::strerror(frame_write_error)));
		    }
		raw_bytes_written_[camera.index] += bytes_used;

		const auto stats = request.metadata().get(controls::rpi::PispStatsOutput);
		if (!stats || stats->size() != kStatsBytes)
			throw std::runtime_error("Missing or invalid PISP_FE_STATS block");
		const uint64_t stats_offset = stats_bytes_written_[camera.index];
		files.stats.write(reinterpret_cast<const char *>(stats->data()),
				  static_cast<std::streamsize>(stats->size()));
		if (!files.stats)
			throw std::runtime_error("Failed writing PISP_FE_STATS");
		stats_bytes_written_[camera.index] += stats->size();

		Json row = { { "camera_index", camera.index },
			     { "pair_index", pair_index },
			     { "frame_sequence", request.sequence() },
			     { "target_fps", target_fps },
			     { "raw_format", camera.configuration->at(0).pixelFormat.toString() },
			     { "width", camera.configuration->at(0).size.width },
			     { "height", camera.configuration->at(0).size.height },
			     { "raw_offset", raw_offset },
			     { "raw_bytes", bytes_used },
			     { "stats_offset", stats_offset },
			     { "stats_bytes", stats->size() },
			     { "pair_sensor_skew_ns", pair_skew_ns } };
		const auto sensor_timestamp = request.metadata().get(controls::SensorTimestamp);
		if (sensor_timestamp)
		{
			row["sensor_timestamp_ns"] = *sensor_timestamp;
			const auto wall_now_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(
					std::chrono::system_clock::now().time_since_epoch()).count();
			const auto monotonic_now_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(
					SteadyClock::now().time_since_epoch()).count();
			const int64_t frame_wallclock_ns = wall_now_ns +
					(static_cast<int64_t>(*sensor_timestamp) - monotonic_now_ns);
			if (frame_wallclock_ns > 0)
				row["frame_wallclock_ns"] = static_cast<uint64_t>(frame_wallclock_ns);
		}
		if (const auto exposure = request.metadata().get(controls::ExposureTime))
			row["exposure_time_us"] = *exposure;
		if (const auto gain = request.metadata().get(controls::AnalogueGain))
			row["analogue_gain"] = *gain;
		if (const auto ready = request.metadata().get(controls::rpi::SyncReady))
		{
			row["sync_ready"] = *ready;
			if (*ready)
				++counts_.sync_ready_frames[camera.index];
		}
		if (const auto timer = request.metadata().get(controls::rpi::SyncTimer))
			row["sync_timer_us"] = *timer;
		files.metadata << row.dump() << '\n';
		files.metadata.flush();
		if (!files.metadata)
			throw std::runtime_error("Failed flushing frame metadata JSONL");

		++counts_.frames_saved;
		++counts_.camera_frames_saved[camera.index];
		return true;
	}

	void recordPair(uint64_t skew_ns)
	{
		++counts_.pairs_received;
		counts_.max_sensor_skew_ns = std::max(counts_.max_sensor_skew_ns, skew_ns);
	}

	void recordSavedPair()
	{
		++counts_.pairs_saved;
	}

	void recordUnpaired(unsigned int camera_index)
	{
		++counts_.unpaired_frames_dropped[camera_index];
	}

	bool rotationDue(SteadyClock::time_point now) const
	{
		return now - chunk_started_ >= std::chrono::duration<double>(chunk_seconds_);
	}

	void rotate(unsigned int target_fps, const std::filesystem::path &telemetry_path)
	{
		finalize(target_fps, telemetry_path);
		++chunk_index_;
		openChunk();
	}

	void finalize(unsigned int target_fps, const std::filesystem::path &telemetry_path)
	{
		if (finalized_)
			return;
		closeFiles();

		Json flight_telemetry = nullptr;
		std::string telemetry_error;
		try
		{
			std::ifstream input(telemetry_path);
			if (!input)
				throw std::runtime_error("cannot open " + telemetry_path.string());
			input >> flight_telemetry;
			if (!flight_telemetry.is_object())
				throw std::runtime_error("flight telemetry root is not a JSON object");
		}
		catch (const std::exception &error)
		{
			flight_telemetry = nullptr;
			telemetry_error = error.what();
		}

		const double end_monotonic = monotonicSeconds(SteadyClock::now());
		Json summary = {
			{ "chunk", chunk_index_ },
			{ "frames_recibidos", counts_.frames_received },
			{ "frames_recibidos_fallidos", counts_.frames_received_failed },
			{ "requests_cancelados", counts_.requests_cancelled },
			{ "frames_guardados", counts_.frames_saved },
			{ "pares_recibidos", counts_.pairs_received },
			{ "pares_guardados", counts_.pairs_saved },
			{ "frames_guardados_por_camara", counts_.camera_frames_saved },
			{ "frames_huerfanos_descartados_por_camara", counts_.unpaired_frames_dropped },
			{ "fps_objetivo", target_fps },
			{ "fps_sensor", kSensorFps },
			{ "inicio_monotonic", monotonicSeconds(chunk_started_) },
			{ "fin_monotonic", end_monotonic },
			{ "max_sensor_skew_ns", counts_.max_sensor_skew_ns },
			{ "frames_guardados_sync_ready_por_camara", counts_.sync_ready_frames },
			{ "raw_format", "BGGR_PISP_COMP1" },
			{ "width", 4608 },
			{ "height", 2592 },
			{ "stats_bytes_per_frame", kStatsBytes },
			{ "flight_telemetry", flight_telemetry }
		};
		if (!telemetry_error.empty())
			summary["flight_telemetry_error"] = telemetry_error;

		const std::filesystem::path telemetry_output = temporary_directory_ / "chunk_telemetry.json";
		std::ofstream telemetry_file(telemetry_output, std::ios::out | std::ios::trunc);
		if (!telemetry_file)
			throw std::runtime_error("Cannot create chunk telemetry JSON");
		telemetry_file << summary.dump(2) << '\n';
		telemetry_file.flush();
		telemetry_file.close();
		if (!telemetry_file)
			throw std::runtime_error("Failed writing chunk telemetry JSON");

		if (std::filesystem::exists(final_directory_))
			throw std::runtime_error("Refusing to replace existing chunk " + final_directory_.string());
		std::filesystem::rename(temporary_directory_, final_directory_);
		finalized_ = true;
		std::cout << "Committed " << final_directory_ << ": " << counts_.frames_saved
			  << " frames, " << counts_.pairs_saved << " pairs, target " << target_fps << " fps\n";
	}

	SteadyClock::time_point chunkStarted() const { return chunk_started_; }

private:
	static double monotonicSeconds(SteadyClock::time_point time)
	{
		return std::chrono::duration<double>(time.time_since_epoch()).count();
	}

	void openChunk()
	{
		std::ostringstream suffix;
		suffix << std::setw(4) << std::setfill('0') << chunk_index_;
		const std::string number = suffix.str();
		temporary_directory_ = output_directory_ / (".chunk_" + number + "_tmp");
		final_directory_ = output_directory_ / ("chunk_" + number);
		if (std::filesystem::exists(temporary_directory_) || std::filesystem::exists(final_directory_))
			throw std::runtime_error("Chunk path already exists; refusing to overwrite " + number);
		if (!std::filesystem::create_directory(temporary_directory_))
			throw std::runtime_error("Failed to create temporary chunk directory");

		for (unsigned int camera = 0; camera < kCameraCount; ++camera)
		{
			const std::string prefix = "cam" + std::to_string(camera);
			CameraFiles &files = files_[camera];
			files.frames.open(temporary_directory_ / (prefix + "_frames.raw"),
					  std::ios::binary | std::ios::out | std::ios::app);
			files.stats.open(temporary_directory_ / (prefix + "_stats.bin"),
					 std::ios::binary | std::ios::out | std::ios::app);
			files.metadata.open(temporary_directory_ / (prefix + "_metadata.jsonl"),
					    std::ios::out | std::ios::app);
			if (!files.frames || !files.stats || !files.metadata)
				throw std::runtime_error("Failed opening all chunk output files");
		}
		counts_ = {};
		raw_bytes_written_ = {};
		stats_bytes_written_ = {};
		chunk_started_ = SteadyClock::now();
		finalized_ = false;
	}

	void closeFiles()
	{
		for (CameraFiles &files : files_)
		{
			for (std::ofstream *file : { &files.frames, &files.stats, &files.metadata })
			{
				file->flush();
				file->close();
				if (file->fail())
					throw std::runtime_error("Failed closing a chunk output file");
			}
		}
	}

	std::filesystem::path output_directory_;
	double chunk_seconds_;
	unsigned int chunk_index_;
	std::filesystem::path temporary_directory_;
	std::filesystem::path final_directory_;
	std::array<CameraFiles, kCameraCount> files_;
	ChunkCounts counts_;
	std::array<uint64_t, kCameraCount> raw_bytes_written_{};
	std::array<uint64_t, kCameraCount> stats_bytes_written_{};
	SteadyClock::time_point chunk_started_;
	bool finalized_ = false;
};

uint64_t sensorTimestamp(const Request &request)
{
	return request.metadata().get(controls::SensorTimestamp).value_or(0);
}

void requeueRequest(CameraState &camera, Request *request, const CaptureSettings &settings)
{
	request->reuse(Request::ReuseBuffers);
	request->controls().set(controls::rpi::StatsOutputEnable, true);
	request->controls().set(controls::FrameDurationLimits, { kFrameDurationUs, kFrameDurationUs });
	applyCaptureControls(request->controls(), settings);
	const int result = camera.camera->queueRequest(request);
	if (result < 0)
		throw std::runtime_error("Failed to requeue camera " + std::to_string(camera.index) +
					 " request: " + std::to_string(result));
}

class PairProcessor
{
public:
	PairProcessor(std::array<CameraState *, kCameraCount> cameras, CompletionQueue &completion_queue,
		      ChunkWriter &writer, TargetFpsPoller &fps_poller,
											CaptureSettings capture_settings,
		      std::chrono::duration<double> chunk_duration,
		      std::filesystem::path telemetry_path)
		: cameras_(cameras), completion_queue_(completion_queue), writer_(writer), fps_poller_(fps_poller),
									capture_settings_(capture_settings), chunk_duration_(chunk_duration),
									telemetry_path_(std::move(telemetry_path))
	{
	}

	void processAvailable(bool allow_requeue)
	{
		for (const Completion &completion : completion_queue_.takeAll())
		{
			writer_.recordReceived(completion.status);
			if (completion.status != Request::RequestComplete)
			{
				if (allow_requeue)
					requeueRequest(*cameras_[completion.camera_index], completion.request,
						       capture_settings_);
				continue;
			}
			pending_[completion.camera_index].push_back(completion.request);
		}

		while (!pending_[0].empty() && !pending_[1].empty() &&
		       !stop_requested.load(std::memory_order_relaxed))
		{
			const uint64_t timestamp0 = sensorTimestamp(*pending_[0].front());
			const uint64_t timestamp1 = sensorTimestamp(*pending_[1].front());
			const uint64_t skew = timestamp0 > timestamp1 ? timestamp0 - timestamp1 : timestamp1 - timestamp0;

			if (timestamp0 && timestamp1 && skew > kFrameMismatchNs)
			{
				const unsigned int older_camera = timestamp0 < timestamp1 ? 0 : 1;
				Request *orphan = pending_[older_camera].front();
				pending_[older_camera].pop_front();
				writer_.recordUnpaired(older_camera);
				if (allow_requeue)
					requeueRequest(*cameras_[older_camera], orphan, capture_settings_);
				continue;
			}

			if (allow_requeue)
				rotateIfDue();
			Request *request0 = pending_[0].front();
			Request *request1 = pending_[1].front();
			pending_[0].pop_front();
			pending_[1].pop_front();
			writer_.recordPair(skew);

			const unsigned int target_fps = fps_poller_.value();
			phase_ += target_fps;
			const bool save_pair = phase_ >= kSensorFps;
						if (save_pair)
				phase_ -= kSensorFps;

			std::exception_ptr write_error;
			try
			{
								if (save_pair && pair_index_ >= capture_settings_.settle_frames)
				{
					const bool first_saved = writer_.appendFrame(
						*cameras_[0], *request0, pair_index_, target_fps, skew);
					const bool second_saved = first_saved && writer_.appendFrame(
						*cameras_[1], *request1, pair_index_, target_fps, skew);
					if (first_saved && second_saved)
						writer_.recordSavedPair();
				}
			}
			catch (...)
			{
				write_error = std::current_exception();
			}

			if (allow_requeue)
			{
				std::exception_ptr requeue_error;
				try
				{
										requeueRequest(*cameras_[0], request0, capture_settings_);
				}
				catch (...)
				{
					requeue_error = std::current_exception();
				}
				try
				{
										requeueRequest(*cameras_[1], request1, capture_settings_);
				}
				catch (...)
				{
					if (!requeue_error)
						requeue_error = std::current_exception();
				}
				if (requeue_error)
					std::rethrow_exception(requeue_error);
			}
			if (write_error)
				std::rethrow_exception(write_error);
			++pair_index_;
		}
	}

	void rotateIfDue()
	{
		const auto now = SteadyClock::now();
		while (now - writer_.chunkStarted() >= chunk_duration_)
			writer_.rotate(fps_poller_.value(), telemetry_path_);
	}

	void rotateIfDueNow()
	{
		rotateIfDue();
	}

	void discardUnpairedPending()
	{
		for (unsigned int camera = 0; camera < kCameraCount; ++camera)
		{
			while (!pending_[camera].empty())
			{
				pending_[camera].pop_front();
				writer_.recordUnpaired(camera);
			}
		}
	}

private:
	std::array<CameraState *, kCameraCount> cameras_;
	CompletionQueue &completion_queue_;
	ChunkWriter &writer_;
	TargetFpsPoller &fps_poller_;
	CaptureSettings capture_settings_;
	std::chrono::duration<double> chunk_duration_;
	std::filesystem::path telemetry_path_;
	std::array<std::deque<Request *>, kCameraCount> pending_;
	unsigned int phase_ = 0;
	uint64_t pair_index_ = 0;
};

} // namespace

int main(int argc, char **argv)
{
	std::signal(SIGTERM, handleSignal);
	std::signal(SIGINT, handleSignal);

	try
	{
		const Options options = parseOptions(argc, argv);
		if (options.check_config)
		{
			std::cout << "Capture profile valid: exposure=auto/" << options.capture.exposure_mode_name
				  << " metering=" << options.capture.metering_mode_name
				  << " constraint=" << options.capture.constraint_mode_name
				  << " ev=" << options.capture.ev
				  << " settle_frames=" << options.capture.settle_frames << '\n';
			return 0;
		}
		CameraManager manager;
		if (manager.start())
			throw std::runtime_error("Failed to start CameraManager");

		const auto available_cameras = manager.cameras();
		if (available_cameras.size() < kCameraCount)
			throw std::runtime_error("Two cameras (indices 0 and 1) are required");

		CompletionQueue completion_queue;
		std::array<std::unique_ptr<CameraState>, kCameraCount> camera_storage;
		for (unsigned int index = 0; index < kCameraCount; ++index)
		{
			camera_storage[index] = std::make_unique<CameraState>();
			camera_storage[index]->index = index;
						configureCamera(*camera_storage[index], available_cameras[index], options.capture);
		}

		ChunkWriter writer(options.output_directory, options.chunk_seconds);
		TargetFpsPoller fps_poller(options.target_fps_file, options.output_directory,
					   options.max_target_fps);
		std::array<CameraState *, kCameraCount> cameras = {
			camera_storage[0].get(), camera_storage[1].get()
		};
		PairProcessor processor(cameras, completion_queue, writer, fps_poller,
									   options.capture, std::chrono::duration<double>(options.chunk_seconds),
				       options.flight_telemetry_file);

		for (CameraState *camera : cameras)
		{
			for (const auto &request : camera->requests)
				completion_queue.registerRequest(request.get(), camera->index);
			camera->camera->requestCompleted.connect(&completion_queue, &CompletionQueue::completed,
								 ConnectionTypeDirect);
		}

		/* El cliente arranca antes que el servidor para no perder el primer paquete de sync. */
		for (CameraState *camera : { cameras[1], cameras[0] })
		{
						ControlList start_controls = makeControls(camera->index, options.sync, options.capture);
			if (camera->camera->start(&start_controls))
				throw std::runtime_error("Failed to start camera " + std::to_string(camera->index));
			camera->started = true;
		}

		const size_t request_count = std::min(camera_storage[0]->requests.size(),
						     camera_storage[1]->requests.size());
		for (size_t request_index = 0; request_index < request_count; ++request_index)
		{
			for (CameraState *camera : cameras)
			{
				Request *request = camera->requests[request_index].get();
				const int result = camera->camera->queueRequest(request);
				if (result < 0)
					throw std::runtime_error("Initial queueRequest failed for camera " +
								 std::to_string(camera->index) + ": " + std::to_string(result));
			}
		}

		std::cout << "Recording dual 4608x2592 BGGR_PISP_COMP1 at " << kSensorFps
			  << " sensor fps; chunk time " << options.chunk_seconds << " s; output "
			  << options.output_directory << '\n';

		bool fps_initialized = false;
		while (!stop_requested.load(std::memory_order_relaxed))
		{
			const auto now = SteadyClock::now();
			const unsigned int old_fps = fps_poller.value();
			const unsigned int target_fps = fps_poller.pollIfDue(now);
			if (!fps_initialized || target_fps != old_fps)
			{
				std::cout << "target_fps=" << target_fps << '\n';
				fps_initialized = true;
			}

			completion_queue.waitFor(100ms);
			processor.processAvailable(true);
			processor.rotateIfDueNow();
		}

		processor.processAvailable(true);
		for (CameraState *camera : cameras)
		{
			camera->camera->stop();
			camera->started = false;
		}
		for (CameraState *camera : cameras)
			camera->camera->requestCompleted.disconnect(&completion_queue);
		processor.processAvailable(false);
		processor.discardUnpairedPending();

		writer.finalize(fps_poller.value(), options.flight_telemetry_file);
		for (auto &camera : camera_storage)
			camera->shutdown();
		return 0;
	}
	catch (const std::exception &error)
	{
		std::cerr << "demeter_rec: " << error.what() << '\n';
		return 1;
	}
}

package io.still.client;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import androidx.media3.common.*;
import androidx.media3.datasource.*;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter;
import androidx.media3.extractor.text.CuesWithTiming;
import androidx.media3.extractor.text.DefaultSubtitleParserFactory;
import androidx.media3.extractor.text.SubtitleParser;
import androidx.media3.ui.PlayerView;
import java.util.*;
import org.json.JSONArray;
import org.json.JSONObject;

public class PlaybackActivity extends Activity {
    static PlaybackActivity current;
    private ExoPlayer player;
    private boolean ended, finished, ready, explicitNext, showSources, seeking;
    private String error;
    private LinearLayout top, bottom;
    private SeekBar timeline;
    private TextView time;
    private Button pause;
    private ProgressBar spinner;
    private FrameLayout loader;
    private ImageView frost;
    private View glass;
    private TextView percent;
    private float progress = 0.5f;
    private final Handler handler = new Handler();
    private int ticks;
    private long playbackStartedAt, firstFrameMs, stallStartedAt, stalledMs;
    private int stallCount;
    private int networkRecoveries;
    private boolean resumeAfterPause;
    private boolean autoSourceSwitch;
    private DefaultBandwidthMeter bandwidth;
    private final Runnable hide = () -> { if (player != null && player.isPlaying()) { top.setVisibility(View.INVISIBLE); bottom.setVisibility(View.INVISIBLE); } };
    private final Runnable report = new Runnable() {
        public void run() {
            if (player != null && player.getDuration() > 0) {
                double position = player.getCurrentPosition() / 1000.0, duration = player.getDuration() / 1000.0;
                if (!seeking) timeline.setProgress((int) (position / duration * 1000));
                time.setText(stamp(position) + " / " + stamp(duration));
                pause.setText(player.isPlaying() ? "Ⅱ" : "▶");
                if (++ticks % 5 == 0 && MainActivity.current != null) MainActivity.current.progress(position, duration);
            }
            handler.postDelayed(this, 1000);
        }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); current=this; getWindow().setFlags(1024, 1024); getWindow().addFlags(128);
        try {
            JSONObject payload = new JSONObject(getIntent().getStringExtra("payload"));
            autoSourceSwitch = payload.optBoolean("autoSourceSwitch", true);
            Map<String, String> requestHeaders = new HashMap<>(); JSONObject headers = payload.optJSONObject("headers");
            if (headers != null) for (Iterator<String> keys = headers.keys(); keys.hasNext();) { String key = keys.next(); requestHeaders.put(key, headers.getString(key)); }
            DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory().setDefaultRequestProperties(requestHeaders).setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(60000).setReadTimeoutMs(60000); // the engine holds a request open while it finds torrent peers
            // A larger in-memory reserve absorbs brief peer/network stalls without disk caching.
            long maxBitrate = payload.optLong("maxBitrate", 0);
            int learnedTarget = payload.optInt("bufferTarget", 45) * 1000;
            int minBuffer = Math.max(learnedTarget, maxBitrate > 30000000 ? 65000 : 45000);
            int maxBuffer = Math.max(minBuffer + 30000, maxBitrate > 30000000 ? 120000 : 90000);
            DefaultLoadControl buffering = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(minBuffer, maxBuffer, 3000, 8000)
                .setPrioritizeTimeOverSizeThresholds(false)
                .build();
            bandwidth = DefaultBandwidthMeter.getSingletonInstance(this);
            DefaultDataSource.Factory data = new DefaultDataSource.Factory(this, http).setTransferListener(bandwidth);
            DefaultMediaSourceFactory mediaSources = new DefaultMediaSourceFactory(data);
            long subtitleOffsetUs = Math.round(payload.optDouble("subtitleOffset", 0) * 1000000.0);
            if (subtitleOffsetUs != 0) mediaSources.setSubtitleParserFactory(offsetSubtitleFactory(subtitleOffsetUs));
            player = new ExoPlayer.Builder(this).setLoadControl(buffering).setBandwidthMeter(bandwidth).setMediaSourceFactory(mediaSources).build();
            TrackSelectionParameters.Builder selection = player.getTrackSelectionParameters().buildUpon().setPreferredAudioLanguage(payload.optString("audio", "en")).setPreferredTextLanguage(payload.optString("subtitle", "en")).setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !payload.optBoolean("subtitles", true));
            if (maxBitrate > 0) selection.setMaxVideoBitrate((int)Math.min(Integer.MAX_VALUE, maxBitrate));
            selection.setAudioOffloadPreferences(new TrackSelectionParameters.AudioOffloadPreferences.Builder().setAudioOffloadMode(payload.optBoolean("audioPassthrough", false) ? TrackSelectionParameters.AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_ENABLED : TrackSelectionParameters.AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_DISABLED).build());
            player.setTrackSelectionParameters(selection.build());
            player.setVideoChangeFrameRateStrategy(payload.optBoolean("frameRateMatching", true) ? C.VIDEO_CHANGE_FRAME_RATE_STRATEGY_ONLY_IF_SEAMLESS : C.VIDEO_CHANGE_FRAME_RATE_STRATEGY_OFF);
            buildControls(payload);
            playbackStartedAt = android.os.SystemClock.elapsedRealtime();
            player.addListener(new Player.Listener() {
                @Override public void onRenderedFirstFrame() { if (firstFrameMs == 0) { firstFrameMs = android.os.SystemClock.elapsedRealtime() - playbackStartedAt; if (MainActivity.current != null) MainActivity.current.playbackHealth("success"); } }
                @Override public void onPlayerError(PlaybackException exception) {
                    boolean transientNetwork = exception.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED
                        || exception.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT;
                    if (transientNetwork && networkRecoveries < 2) {
                        handler.postDelayed(() -> { if (!finished && player != null) player.prepare(); }, ++networkRecoveries * 1000L);
                        return;
                    }
                    error = "This source could not be played."; finish();
                }
                @Override public void onIsPlayingChanged(boolean playing) { if (playing) reveal(); }
                @Override public void onPlaybackStateChanged(int state) {
                    long now = android.os.SystemClock.elapsedRealtime();
                    if (state == Player.STATE_BUFFERING && ready && player.getPlayWhenReady() && !seeking && stallStartedAt == 0) { stallCount++; stallStartedAt = now; if (MainActivity.current != null) MainActivity.current.playbackHealth("stall"); handler.postDelayed(() -> { if (!finished && autoSourceSwitch && stallStartedAt != 0 && android.os.SystemClock.elapsedRealtime() - stallStartedAt >= 15000) { error = "Playback kept buffering. Trying another source."; finish(); } }, 15000); }
                    if (state != Player.STATE_BUFFERING && stallStartedAt != 0) { stalledMs += now - stallStartedAt; stallStartedAt = 0; }
                    spinner.setVisibility(state == Player.STATE_READY || state == Player.STATE_ENDED ? View.GONE : View.VISIBLE);
                    if (state == Player.STATE_READY) { ready = true; finishLoader(); }
                    if (state == Player.STATE_ENDED) { ended = true; finish(); }
                }
            });
            List<MediaItem.SubtitleConfiguration> subtitles = new ArrayList<>(); JSONArray tracks = payload.optJSONArray("tracks");
            if (tracks != null) for (int i = 0; i < tracks.length(); i++) {
                JSONObject track = tracks.getJSONObject(i); String url = track.optString("url"); if (!url.startsWith("http")) continue;
                String mime = url.matches(".*\\.srt(?:\\?.*)?$") ? MimeTypes.APPLICATION_SUBRIP : MimeTypes.TEXT_VTT;
                subtitles.add(new MediaItem.SubtitleConfiguration.Builder(Uri.parse(url)).setMimeType(mime).setLanguage(track.optString("lang")).build());
            }
            player.setMediaItem(new MediaItem.Builder().setUri(payload.getString("url")).setSubtitleConfigurations(subtitles).build());
            player.seekTo((long) (payload.optDouble("position", 0) * 1000)); player.prepare(); player.play(); handler.post(report);
            handler.postDelayed(() -> { if (!ready && !finished) { error = "This source did not start in time."; finish(); } }, payload.optBoolean("torrent") ? 120000 : 30000);
        } catch (Exception exception) { error = "Invalid playback source."; finish(); }
    }
    private void buildControls(JSONObject payload) {
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.BLACK);
        PlayerView video = new PlayerView(this); video.setPlayer(player); video.setUseController(false); root.addView(video, new FrameLayout.LayoutParams(-1, -1)); spinner = new ProgressBar(this); root.addView(spinner, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));
        top = row(); top.setPadding(24, 8, 24, 8); top.setBackgroundColor(0x99000000); top.addView(button("← Back", () -> finish()));
        TextView title = new TextView(this); title.setText(payload.optString("title")); title.setTextColor(Color.WHITE); title.setTextSize(18); title.setGravity(Gravity.CENTER);
        top.addView(title, new LinearLayout.LayoutParams(0, -2, 1)); top.addView(button("•••", () -> options())); root.addView(top, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        bottom = new LinearLayout(this); bottom.setOrientation(LinearLayout.VERTICAL); bottom.setPadding(32, 10, 32, 20); bottom.setBackgroundColor(0xbb000000);
        timeline = new SeekBar(this); timeline.setMax(1000); timeline.setContentDescription("Playback position"); bottom.addView(timeline);
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() { public void onStartTrackingTouch(SeekBar bar) { seeking = true; } public void onStopTrackingTouch(SeekBar bar) { seeking = false; if (player.getDuration() > 0) player.seekTo(player.getDuration() * bar.getProgress() / 1000); reveal(); } public void onProgressChanged(SeekBar bar, int value, boolean user) { if (user && !seeking && player.getDuration() > 0) player.seekTo(player.getDuration() * value / 1000); } });
        LinearLayout transport = row(); time = new TextView(this); time.setTextColor(Color.WHITE); time.setTextSize(14); transport.addView(time, new LinearLayout.LayoutParams(0, -2, 1));
        pause = button("Ⅱ", () -> { if (player.isPlaying()) player.pause(); else player.play(); }); pause.setContentDescription("Play or pause"); transport.addView(pause);
        transport.addView(button("Audio & subtitles", () -> new AlertDialog.Builder(this).setItems(new String[]{"Audio language", "Subtitles"}, (d, which) -> chooseTrack(which == 0 ? C.TRACK_TYPE_AUDIO : C.TRACK_TYPE_TEXT)).show()));
        if (payload.optBoolean("hasNext")) transport.addView(button("Next episode →", () -> { explicitNext = true; finish(); }));
        bottom.addView(transport); root.addView(bottom, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM)); buildLoader(root, payload); root.setOnClickListener(v -> reveal()); setContentView(root); pause.requestFocus(); reveal();
    }
    private LinearLayout row() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.HORIZONTAL); view.setGravity(Gravity.CENTER_VERTICAL); return view; }
    private SubtitleParser.Factory offsetSubtitleFactory(long offsetUs) {
        DefaultSubtitleParserFactory base = new DefaultSubtitleParserFactory();
        return new SubtitleParser.Factory() {
            @Override public boolean supportsFormat(Format format) { return base.supportsFormat(format); }
            @Override public int getCueReplacementBehavior(Format format) { return base.getCueReplacementBehavior(format); }
            @Override public SubtitleParser create(Format format) {
                SubtitleParser parser = base.create(format);
                return new SubtitleParser() {
                    @Override public void parse(byte[] data, int offset, int length, SubtitleParser.OutputOptions options, androidx.media3.common.util.Consumer<CuesWithTiming> output) {
                        parser.parse(data, offset, length, options, cues -> output.accept(new CuesWithTiming(cues.cues, Math.max(0, cues.startTimeUs + offsetUs), cues.durationUs)));
                    }
                    @Override public int getCueReplacementBehavior() { return parser.getCueReplacementBehavior(); }
                    @Override public void reset() { parser.reset(); }
                };
            }
        };
    }
    private void showStatistics() {
        Format video = player.getVideoFormat();
        androidx.media3.exoplayer.DecoderCounters counters = player.getVideoDecoderCounters();
        if (counters != null) counters.ensureUpdated();
        long stallTime = stalledMs + (stallStartedAt == 0 ? 0 : android.os.SystemClock.elapsedRealtime() - stallStartedAt);
        String message = String.format(Locale.UK,
            "Buffered: %.1f s\nNetwork estimate: %.1f Mbps\nStartup: %.1f s\nBuffering: %d events, %.1f s\nDropped frames: %d\nVideo: %s",
            player.getTotalBufferedDuration() / 1000.0,
            bandwidth == null ? 0 : bandwidth.getBitrateEstimate() / 1000000.0,
            firstFrameMs / 1000.0, stallCount, stallTime / 1000.0,
            counters == null ? 0 : counters.droppedBufferCount,
            video == null ? "Unknown" : video.sampleMimeType + " " + video.width + "×" + video.height);
        new AlertDialog.Builder(this).setTitle("Playback statistics").setMessage(message).setPositiveButton("Close", null).show();
    }
    private Button button(String label, Runnable action) {
        Button button = new Button(this); button.setText(label); button.setAllCaps(false); button.setTextColor(Color.WHITE); button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0x333b4f40));
        button.setOnClickListener(v -> { action.run(); reveal(); }); button.setOnFocusChangeListener((v, focused) -> { button.setTextColor(focused ? 0xff1f2c22 : Color.WHITE); button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(focused ? 0xffedf1e6 : 0x333b4f40)); if (focused) reveal(); }); return button;
    }
    private void reveal() { if (top == null || bottom == null) return; top.setVisibility(View.VISIBLE); bottom.setVisibility(View.VISIBLE); handler.removeCallbacks(hide); handler.postDelayed(hide, 5000); }
    @Override public boolean dispatchKeyEvent(android.view.KeyEvent event) { if (event.getKeyCode() != android.view.KeyEvent.KEYCODE_BACK) reveal(); return super.dispatchKeyEvent(event); }
    private void options() { new AlertDialog.Builder(this).setTitle("Playback").setItems(new String[]{"Change source", "Playback speed", "Playback statistics"}, (d, which) -> { if (which == 0) { showSources = true; finish(); } else if (which == 1) new AlertDialog.Builder(this).setItems(new String[]{"0.75×", "1×", "1.25×", "1.5×", "2×"}, (dialog, index) -> player.setPlaybackSpeed(new float[]{.75f, 1f, 1.25f, 1.5f, 2f}[index])).show(); else showStatistics(); }).show(); }
    private void chooseTrack(int type) {
        List<String> labels = new ArrayList<>(); List<TrackSelectionOverride> overrides = new ArrayList<>(); labels.add(type == C.TRACK_TYPE_TEXT ? "Off" : "Automatic"); overrides.add(null);
        for (Tracks.Group group : player.getCurrentTracks().getGroups()) if (group.getType() == type) for (int i = 0; i < group.length; i++) if (group.isTrackSupported(i)) { Format format = group.getTrackFormat(i); labels.add(format.label != null ? format.label : format.language != null ? format.language : "Track " + (i + 1)); overrides.add(new TrackSelectionOverride(group.getMediaTrackGroup(), i)); }
        new AlertDialog.Builder(this).setTitle(type == C.TRACK_TYPE_TEXT ? "Subtitles" : "Audio language").setItems(labels.toArray(new String[0]), (dialog, index) -> { TrackSelectionParameters.Builder parameters = player.getTrackSelectionParameters().buildUpon().clearOverridesOfType(type).setTrackTypeDisabled(type, type == C.TRACK_TYPE_TEXT && index == 0); if (overrides.get(index) != null) parameters.addOverride(overrides.get(index)); player.setTrackSelectionParameters(parameters.build()); }).show();
    }
    // Artwork starts frosted (a tiny copy scaled up) and sharpens as progress climbs; the web UI hands over at 50%.
    private void buildLoader(FrameLayout root, JSONObject payload) {
        loader = new FrameLayout(this); loader.setBackgroundColor(0xFF101A15);
        ImageView art = new ImageView(this); frost = new ImageView(this);
        for (ImageView view : new ImageView[] { art, frost }) { view.setScaleType(ImageView.ScaleType.CENTER_CROP); loader.addView(view, new FrameLayout.LayoutParams(-1, -1)); }
        glass = new View(this); glass.setBackgroundColor(0xFF101A15); loader.addView(glass, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout box = new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL); box.setGravity(Gravity.CENTER_HORIZONTAL);
        percent = new TextView(this); percent.setTextColor(Color.WHITE); percent.setTextSize(44); percent.setGravity(Gravity.CENTER);
        TextView name = new TextView(this); name.setText(payload.optString("title")); name.setTextColor(Color.WHITE); name.setTextSize(26); name.setGravity(Gravity.CENTER); name.setPadding(0, 16, 0, 6);
        TextView label = new TextView(this); label.setText(payload.optBoolean("torrent") ? "FINDING PEERS" : "CONNECTING"); label.setTextColor(0xCCFFFFFF); label.setTextSize(13); label.setLetterSpacing(0.2f);
        box.addView(percent); box.addView(name); box.addView(label);
        loader.addView(box, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER)); root.addView(loader, new FrameLayout.LayoutParams(-1, -1));
        paintLoader();
        String url = payload.optString("art");
        if (url.startsWith("http")) new Thread(() -> {
            try {
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) new java.net.URL(url).openConnection(); connection.setConnectTimeout(8000); connection.setReadTimeout(8000);
                android.graphics.BitmapFactory.Options options = new android.graphics.BitmapFactory.Options(); options.inSampleSize = 2;
                android.graphics.Bitmap sharp = android.graphics.BitmapFactory.decodeStream(connection.getInputStream(), null, options);
                if (sharp == null) return;
                android.graphics.Bitmap small = android.graphics.Bitmap.createScaledBitmap(sharp, Math.max(1, sharp.getWidth() / 32), Math.max(1, sharp.getHeight() / 32), true);
                runOnUiThread(() -> { if (!finished) { art.setImageBitmap(sharp); frost.setImageBitmap(small); paintLoader(); } });
            } catch (Exception ignored) { /* The loader still works without artwork. */ }
        }).start();
        handler.postDelayed(new Runnable() { public void run() { if (loader.getVisibility() != View.VISIBLE || ready) return; progress += (0.92f - progress) * 0.04f; paintLoader(); handler.postDelayed(this, 250); } }, 250);
    }
    private void paintLoader() { percent.setText(Math.round(progress * 100) + "%"); frost.setAlpha(1 - progress); glass.setAlpha((1 - progress) * 0.6f); }
    private void finishLoader() {
        if (loader == null || loader.getVisibility() != View.VISIBLE) return;
        progress = 1f; paintLoader();
        loader.animate().alpha(0f).setStartDelay(350).setDuration(500).withEndAction(() -> loader.setVisibility(View.GONE)).start();
    }
    private String stamp(double seconds) { return String.format(Locale.ROOT, "%d:%02d", (int) seconds / 60, (int) seconds % 60); }
    @Override protected void onPause() { super.onPause(); if (player != null) { resumeAfterPause = player.getPlayWhenReady(); player.pause(); } }
    @Override protected void onResume() { super.onResume(); if (player != null && resumeAfterPause && !finished) { resumeAfterPause = false; player.play(); } }
    @Override public void finish() {
        if (finished) return; finished = true; Intent result = new Intent();
        if (player != null) { result.putExtra("position", player.getCurrentPosition() / 1000.0); result.putExtra("duration", Math.max(0, player.getDuration()) / 1000.0); }
        result.putExtra("ended", ended); result.putExtra("next", explicitNext); result.putExtra("sources", showSources); if (error != null) result.putExtra("error", error); setResult(RESULT_OK, result); super.finish();
    }
    @Override protected void onDestroy() { current=null;handler.removeCallbacksAndMessages(null); if (player != null) player.release(); super.onDestroy(); }
}

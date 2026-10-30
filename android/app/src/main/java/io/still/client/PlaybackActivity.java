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
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
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
    private final Handler handler = new Handler();
    private int ticks;
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
            Map<String, String> requestHeaders = new HashMap<>(); JSONObject headers = payload.optJSONObject("headers");
            if (headers != null) for (Iterator<String> keys = headers.keys(); keys.hasNext();) { String key = keys.next(); requestHeaders.put(key, headers.getString(key)); }
            DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory().setDefaultRequestProperties(requestHeaders).setAllowCrossProtocolRedirects(true).setConnectTimeoutMs(60000).setReadTimeoutMs(60000); // the engine holds a request open while it finds torrent peers
            player = new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http))).build();
            player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setPreferredAudioLanguage(payload.optString("audio", "en")).setPreferredTextLanguage(payload.optString("subtitle", "en")).setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !payload.optBoolean("subtitles", true)).build());
            buildControls(payload);
            player.addListener(new Player.Listener() {
                @Override public void onPlayerError(PlaybackException exception) { error = "This source could not be played."; finish(); }
                @Override public void onIsPlayingChanged(boolean playing) { if (playing) reveal(); }
                @Override public void onPlaybackStateChanged(int state) { spinner.setVisibility(state == Player.STATE_READY || state == Player.STATE_ENDED ? View.GONE : View.VISIBLE); if (state == Player.STATE_READY) ready = true; if (state == Player.STATE_ENDED) { ended = true; finish(); } }
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
        timeline.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() { public void onStartTrackingTouch(SeekBar bar) { seeking = true; } public void onStopTrackingTouch(SeekBar bar) { seeking = false; reveal(); } public void onProgressChanged(SeekBar bar, int value, boolean user) { if (user && player.getDuration() > 0) player.seekTo(player.getDuration() * value / 1000); } });
        LinearLayout transport = row(); time = new TextView(this); time.setTextColor(Color.WHITE); time.setTextSize(14); transport.addView(time, new LinearLayout.LayoutParams(0, -2, 1));
        pause = button("Ⅱ", () -> { if (player.isPlaying()) player.pause(); else player.play(); }); pause.setContentDescription("Play or pause"); transport.addView(pause);
        transport.addView(button("Audio & subtitles", () -> new AlertDialog.Builder(this).setItems(new String[]{"Audio language", "Subtitles"}, (d, which) -> chooseTrack(which == 0 ? C.TRACK_TYPE_AUDIO : C.TRACK_TYPE_TEXT)).show()));
        if (payload.optBoolean("hasNext")) transport.addView(button("Next episode →", () -> { explicitNext = true; finish(); }));
        bottom.addView(transport); root.addView(bottom, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM)); root.setOnClickListener(v -> reveal()); setContentView(root); pause.requestFocus(); reveal();
    }
    private LinearLayout row() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.HORIZONTAL); view.setGravity(Gravity.CENTER_VERTICAL); return view; }
    private Button button(String label, Runnable action) {
        Button button = new Button(this); button.setText(label); button.setAllCaps(false); button.setTextColor(Color.WHITE); button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0x333b4f40));
        button.setOnClickListener(v -> { action.run(); reveal(); }); button.setOnFocusChangeListener((v, focused) -> { button.setTextColor(focused ? 0xff1f2c22 : Color.WHITE); button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(focused ? 0xffedf1e6 : 0x333b4f40)); if (focused) reveal(); }); return button;
    }
    private void reveal() { if (top == null || bottom == null) return; top.setVisibility(View.VISIBLE); bottom.setVisibility(View.VISIBLE); handler.removeCallbacks(hide); handler.postDelayed(hide, 5000); }
    @Override public boolean dispatchKeyEvent(android.view.KeyEvent event) { if (event.getKeyCode() != android.view.KeyEvent.KEYCODE_BACK) reveal(); return super.dispatchKeyEvent(event); }
    private void options() { new AlertDialog.Builder(this).setTitle("Playback").setItems(new String[]{"Change source", "Playback speed"}, (d, which) -> { if (which == 0) { showSources = true; finish(); } else new AlertDialog.Builder(this).setItems(new String[]{"0.75×", "1×", "1.25×", "1.5×", "2×"}, (dialog, index) -> player.setPlaybackSpeed(new float[]{.75f, 1f, 1.25f, 1.5f, 2f}[index])).show(); }).show(); }
    private void chooseTrack(int type) {
        List<String> labels = new ArrayList<>(); List<TrackSelectionOverride> overrides = new ArrayList<>(); labels.add(type == C.TRACK_TYPE_TEXT ? "Off" : "Automatic"); overrides.add(null);
        for (Tracks.Group group : player.getCurrentTracks().getGroups()) if (group.getType() == type) for (int i = 0; i < group.length; i++) if (group.isTrackSupported(i)) { Format format = group.getTrackFormat(i); labels.add(format.label != null ? format.label : format.language != null ? format.language : "Track " + (i + 1)); overrides.add(new TrackSelectionOverride(group.getMediaTrackGroup(), i)); }
        new AlertDialog.Builder(this).setTitle(type == C.TRACK_TYPE_TEXT ? "Subtitles" : "Audio language").setItems(labels.toArray(new String[0]), (dialog, index) -> { TrackSelectionParameters.Builder parameters = player.getTrackSelectionParameters().buildUpon().clearOverridesOfType(type).setTrackTypeDisabled(type, type == C.TRACK_TYPE_TEXT && index == 0); if (overrides.get(index) != null) parameters.addOverride(overrides.get(index)); player.setTrackSelectionParameters(parameters.build()); }).show();
    }
    private String stamp(double seconds) { return String.format(Locale.ROOT, "%d:%02d", (int) seconds / 60, (int) seconds % 60); }
    @Override protected void onPause() { super.onPause(); if (player != null) player.pause(); }
    @Override public void finish() {
        if (finished) return; finished = true; Intent result = new Intent();
        if (player != null) { result.putExtra("position", player.getCurrentPosition() / 1000.0); result.putExtra("duration", Math.max(0, player.getDuration()) / 1000.0); }
        result.putExtra("ended", ended); result.putExtra("next", explicitNext); result.putExtra("sources", showSources); if (error != null) result.putExtra("error", error); setResult(RESULT_OK, result); super.finish();
    }
    @Override protected void onDestroy() { current=null;handler.removeCallbacksAndMessages(null); if (player != null) player.release(); super.onDestroy(); }
}

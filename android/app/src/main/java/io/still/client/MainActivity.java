package io.still.client;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.*;
import android.view.WindowManager;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;

public class MainActivity extends Activity {
 static MainActivity current;
 private WebView web;
 @Override public void onCreate(Bundle state){super.onCreate(state);current=this;getWindow().setFlags(1024,1024);web=new WebView(this);setContentView(web);
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setMediaPlaybackRequiresUserGesture(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setSafeBrowsingEnabled(true);
  WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return loader.shouldInterceptRequest(request.getUrl());}@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !request.getUrl().toString().startsWith("https://appassets.androidplatform.net/");}});
  // TVs report 320dpi at 1080p, leaving the web UI only 960 CSS px; 125% scale gives it 1536.
  if((getResources().getConfiguration().uiMode&android.content.res.Configuration.UI_MODE_TYPE_MASK)==android.content.res.Configuration.UI_MODE_TYPE_TELEVISION)web.setInitialScale(125);
  web.addJavascriptInterface(new Bridge(),"StillNative");web.loadUrl("https://appassets.androidplatform.net/assets/public/index.html");
 }
 private class Bridge {
  @JavascriptInterface public void play(String payload){runOnUiThread(()->{Intent intent=new Intent(MainActivity.this,PlaybackActivity.class);intent.putExtra("payload",payload);startActivityForResult(intent,10);});}
  @JavascriptInterface public int maxQuality(){android.view.Display.Mode mode=getWindowManager().getDefaultDisplay().getMode();int width=Math.max(mode.getPhysicalWidth(),mode.getPhysicalHeight());return width>=3840?2160:width>=1920?1080:720;}
  @JavascriptInterface public String codecSupport(){
   java.util.Map<String,Integer> support=new java.util.LinkedHashMap<>();for(String codec:new String[]{"h264","hevc","vp9","av1","aac","ac3","eac3","dts","truehd"})support.put(codec,0);
   for(android.media.MediaCodecInfo info:new android.media.MediaCodecList(android.media.MediaCodecList.ALL_CODECS).getCodecInfos()){if(info.isEncoder())continue;String name=info.getName().toLowerCase(java.util.Locale.ROOT);boolean hardware=android.os.Build.VERSION.SDK_INT>=29?info.isHardwareAccelerated():!name.startsWith("omx.google.")&&!name.startsWith("c2.android.");int score=hardware?2:1;for(String type:info.getSupportedTypes()){String codec=type.equals("video/avc")?"h264":type.equals("video/hevc")?"hevc":type.equals("video/x-vnd.on2.vp9")?"vp9":type.equals("video/av01")?"av1":type.equals("audio/mp4a-latm")?"aac":type.equals("audio/ac3")?"ac3":type.startsWith("audio/eac3")?"eac3":type.startsWith("audio/vnd.dts")?"dts":type.equals("audio/true-hd")?"truehd":null;if(codec!=null)support.put(codec,Math.max(support.get(codec),score));}}
   return new JSONObject(support).toString();
  }
 }
 void progress(double position,double duration){web.evaluateJavascript("window.stillProgress?.({position:"+position+",duration:"+duration+"})",null);}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==10&&data!=null){double position=data.getDoubleExtra("position",0),duration=data.getDoubleExtra("duration",0);web.evaluateJavascript("window.stillProgress?.("+"{position:"+position+",duration:"+duration+",final:true})",null);if(data.hasExtra("error"))web.evaluateJavascript("window.stillPlaybackFailed?.("+JSONObject.quote(data.getStringExtra("error"))+")",null);else if(data.getBooleanExtra("next",false))web.evaluateJavascript("window.stillNext?.()",null);else if(data.getBooleanExtra("sources",false))web.evaluateJavascript("window.stillShowSources?.()",null);else web.evaluateJavascript("window.stillPlaybackEnded?.("+data.getBooleanExtra("ended",false)+")",null);}}
 @Override public void onBackPressed(){web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))",null);}
 @Override public void onDestroy(){current=null;web.removeJavascriptInterface("StillNative");web.destroy();super.onDestroy();}
}

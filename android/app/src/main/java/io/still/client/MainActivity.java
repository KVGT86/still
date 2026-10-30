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
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setMediaPlaybackRequiresUserGesture(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setSafeBrowsingEnabled(true);
  WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return loader.shouldInterceptRequest(request.getUrl());}@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !request.getUrl().toString().startsWith("https://appassets.androidplatform.net/");}});
  web.addJavascriptInterface(new Bridge(),"StillNative");web.loadUrl("https://appassets.androidplatform.net/assets/public/index.html");
 }
 private class Bridge {
  @JavascriptInterface public void setSubtitles(String payload){runOnUiThread(()->{if(PlaybackActivity.current!=null)PlaybackActivity.current.addSubtitles(payload);});}
  @JavascriptInterface public void play(String payload){runOnUiThread(()->{Intent intent=new Intent(MainActivity.this,PlaybackActivity.class);intent.putExtra("payload",payload);startActivityForResult(intent,10);});}
  @JavascriptInterface public int maxQuality(){android.view.Display.Mode mode=getWindowManager().getDefaultDisplay().getMode();int width=Math.max(mode.getPhysicalWidth(),mode.getPhysicalHeight());return width>=3840?2160:width>=1920?1080:720;}
 }
 void progress(double position,double duration){web.evaluateJavascript("window.stillProgress?.({position:"+position+",duration:"+duration+"})",null);}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==10&&data!=null){double position=data.getDoubleExtra("position",0),duration=data.getDoubleExtra("duration",0);web.evaluateJavascript("window.stillProgress?.("+"{position:"+position+",duration:"+duration+",final:true})",null);if(data.hasExtra("error"))web.evaluateJavascript("window.stillPlaybackFailed?.("+JSONObject.quote(data.getStringExtra("error"))+")",null);else if(data.getBooleanExtra("next",false))web.evaluateJavascript("window.stillNext?.()",null);else if(data.getBooleanExtra("sources",false))web.evaluateJavascript("window.stillShowSources?.()",null);else web.evaluateJavascript("window.stillPlaybackEnded?.("+data.getBooleanExtra("ended",false)+")",null);}}
 @Override public void onBackPressed(){web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))",null);}
 @Override public void onDestroy(){current=null;web.removeJavascriptInterface("StillNative");web.destroy();super.onDestroy();}
}

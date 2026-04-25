package com.ambient.canvas.overlay;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.Nullable;

import android.service.dreams.DreamService;

public class AmbientDreamService extends DreamService {
    private WebView dreamWebView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(false);

        dreamWebView = new WebView(this);
        dreamWebView.setBackgroundColor(Color.BLACK);

        WebSettings settings = dreamWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        addContentView(
            dreamWebView,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
    }

    @Override
    public void onDreamingStarted() {
        super.onDreamingStarted();
        if (dreamWebView != null) {
            dreamWebView.loadUrl("file:///android_asset/public/index.html");
        }
    }

    @Override
    public void onDreamingStopped() {
        if (dreamWebView != null) {
            dreamWebView.stopLoading();
        }
        super.onDreamingStopped();
    }

    @Override
    public void onDetachedFromWindow() {
        if (dreamWebView != null) {
            dreamWebView.loadUrl("about:blank");
            dreamWebView.clearHistory();
            dreamWebView.removeAllViews();
            dreamWebView.destroy();
            dreamWebView = null;
        }
        super.onDetachedFromWindow();
    }
}

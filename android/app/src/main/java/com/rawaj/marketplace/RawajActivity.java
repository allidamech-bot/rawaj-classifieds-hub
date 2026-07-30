package com.rawaj.marketplace;

import android.os.Bundle;

public class RawajActivity extends MainActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RawajGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

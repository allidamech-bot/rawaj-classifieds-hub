package com.rawaj.marketplace;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "RawajNative")
public class RawajNativePlugin extends Plugin {
    private static final String AUTH_STORAGE_NAME = "rawaj_native_auth_storage";
    private static final Set<String> ALLOWED_EXTERNAL_SCHEMES = new HashSet<>(
        Arrays.asList("http", "https", "tel", "mailto", "sms", "geo", "market", "whatsapp")
    );

    private SharedPreferences authStorage() {
        return getContext().getSharedPreferences(AUTH_STORAGE_NAME, Context.MODE_PRIVATE);
    }

    private String requiredStorageKey(PluginCall call) {
        final String key = call.getString("key");
        if (key == null || key.trim().isEmpty()) {
            call.reject("A storage key is required.");
            return null;
        }
        return key;
    }

    @PluginMethod
    public void getAuthStorage(PluginCall call) {
        final String key = requiredStorageKey(call);
        if (key == null) {
            return;
        }

        final JSObject result = new JSObject();
        final String value = authStorage().getString(key, null);
        if (value == null) {
            result.put("value", JSObject.NULL);
        } else {
            result.put("value", value);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void setAuthStorage(PluginCall call) {
        final String key = requiredStorageKey(call);
        if (key == null) {
            return;
        }

        final String value = call.getString("value");
        if (value == null) {
            call.reject("A storage value is required.");
            return;
        }

        if (!authStorage().edit().putString(key, value).commit()) {
            call.reject("Unable to persist the auth session.");
            return;
        }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void removeAuthStorage(PluginCall call) {
        final String key = requiredStorageKey(call);
        if (key == null) {
            return;
        }

        if (!authStorage().edit().remove(key).commit()) {
            call.reject("Unable to remove the auth session.");
            return;
        }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        final String value = call.getString("url");
        if (value == null || value.trim().isEmpty()) {
            call.reject("A URL is required.");
            return;
        }

        final Uri uri;
        try {
            uri = Uri.parse(value);
        } catch (RuntimeException error) {
            call.reject("The URL is invalid.", error);
            return;
        }

        final String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_EXTERNAL_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))) {
            call.reject("This URL scheme is not allowed.");
            return;
        }

        final Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);

        try {
            getActivity().startActivity(intent);
            call.resolve(new JSObject());
        } catch (ActivityNotFoundException error) {
            call.reject("No application can open this link.", error);
        } catch (SecurityException error) {
            call.reject("Android blocked this link.", error);
        }
    }
}

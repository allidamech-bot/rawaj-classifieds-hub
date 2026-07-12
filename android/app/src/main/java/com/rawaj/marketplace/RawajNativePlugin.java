package com.rawaj.marketplace;

import android.content.ActivityNotFoundException;
import android.content.Intent;
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
    private static final Set<String> ALLOWED_EXTERNAL_SCHEMES = new HashSet<>(
        Arrays.asList("http", "https", "tel", "mailto", "sms", "geo", "market", "whatsapp")
    );

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

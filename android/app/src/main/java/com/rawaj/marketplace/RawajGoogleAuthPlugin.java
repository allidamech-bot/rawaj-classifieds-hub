package com.rawaj.marketplace;

import android.os.Bundle;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "RawajGoogleAuth")
public class RawajGoogleAuthPlugin extends Plugin {
    private static final String ERROR_CANCELLED = "google_sign_in_cancelled";
    private static final String ERROR_NO_ACCOUNT = "google_sign_in_no_account";
    private static final String ERROR_SETUP = "google_sign_in_setup_required";
    private static final String ERROR_FAILED = "google_sign_in_failed";

    private final AtomicBoolean signInInFlight = new AtomicBoolean(false);

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!signInInFlight.compareAndSet(false, true)) {
            call.reject("Google sign-in is already in progress.", ERROR_FAILED);
            return;
        }

        final String serverClientId = resolveServerClientId();
        if (serverClientId == null) {
            signInInFlight.set(false);
            call.reject("Google OAuth client configuration is missing.", ERROR_SETUP);
            return;
        }

        final GetSignInWithGoogleOption googleOption;
        try {
            googleOption = new GetSignInWithGoogleOption.Builder(serverClientId).build();
        } catch (IllegalArgumentException error) {
            signInInFlight.set(false);
            call.reject("Google OAuth client configuration is invalid.", ERROR_SETUP, error);
            return;
        }

        final GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build();
        final CredentialManager credentialManager = CredentialManager.create(getContext());
        final Executor mainExecutor = ContextCompat.getMainExecutor(getContext());

        credentialManager.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            mainExecutor,
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(@NonNull GetCredentialResponse result) {
                    signInInFlight.set(false);
                    resolveGoogleCredential(call, result.getCredential());
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    signInInFlight.set(false);
                    if (error instanceof GetCredentialCancellationException) {
                        call.reject("Google sign-in was cancelled.", ERROR_CANCELLED, error);
                        return;
                    }
                    if (error instanceof NoCredentialException) {
                        call.reject("No Google account is available for sign-in.", ERROR_NO_ACCOUNT, error);
                        return;
                    }
                    call.reject("Google sign-in failed.", ERROR_FAILED, error);
                }
            }
        );
    }

    @PluginMethod
    public void clearCredentialState(PluginCall call) {
        final CredentialManager credentialManager = CredentialManager.create(getContext());
        credentialManager.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    call.resolve();
                }

                @Override
                public void onError(@NonNull ClearCredentialException error) {
                    call.reject("Could not clear Google credential state.", ERROR_FAILED, error);
                }
            }
        );
    }

    private void resolveGoogleCredential(PluginCall call, Credential credential) {
        if (!(credential instanceof CustomCredential)) {
            call.reject("Unsupported Google credential response.", ERROR_FAILED);
            return;
        }

        final CustomCredential customCredential = (CustomCredential) credential;
        if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
            call.reject("Unsupported Google credential type.", ERROR_FAILED);
            return;
        }

        try {
            final Bundle data = customCredential.getData();
            final GoogleIdTokenCredential googleCredential =
                GoogleIdTokenCredential.createFrom(data);
            final String idToken = googleCredential.getIdToken();
            if (idToken == null || idToken.trim().isEmpty()) {
                call.reject("Google ID token is missing.", ERROR_FAILED);
                return;
            }
            final JSObject result = new JSObject();
            result.put("idToken", idToken);
            call.resolve(result);
        } catch (IllegalArgumentException error) {
            call.reject("Google ID token could not be parsed.", ERROR_FAILED, error);
        }
    }

    private String resolveServerClientId() {
        final int resourceId = getContext()
            .getResources()
            .getIdentifier("default_web_client_id", "string", getContext().getPackageName());
        if (resourceId == 0) {
            return null;
        }
        final String value = getContext().getString(resourceId).trim();
        return value.isEmpty() ? null : value;
    }
}

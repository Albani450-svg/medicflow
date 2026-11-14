"use strict";

function initializeLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const button = document.getElementById("submitButton");
        const message = document.getElementById("formMessage");
        message.textContent = "";
        message.className = "form-message";
        setBusy(button, true, "Memeriksa akun...");
        try {
            const result = await request("auth/login", { method: "POST", body: formObject(form) });
            if (!result.access_token || !result.user || !result.user.role) throw new Error("Server tidak mengembalikan sesi yang valid.");
            if (!roleMenus[result.user.role]) throw new Error("Role akun tidak dikenali. Silakan hubungi administrator.");
            sessionStorage.setItem(tokenKey, result.access_token);
            sessionStorage.setItem(userKey, JSON.stringify(result.user));
            window.location.assign(window.MEDICFLOW_APP_URL);
        } catch (error) {
            message.textContent = error.message;
            setBusy(button, false);
        }
    });
}

function initializeRegistration() {
    const form = document.getElementById("registerForm");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const button = document.getElementById("submitButton");
        const message = document.getElementById("formMessage");
        message.textContent = "";
        message.className = "form-message";
        setBusy(button, true, "Mendaftarkan...");
        const data = formObject(form);
        if (!data.nomor_bpjs) data.nomor_bpjs = null;
        if (!data.alamat) data.alamat = null;
        try {
            await request("auth/register", { method: "POST", body: data });
            message.textContent = "Pendaftaran berhasil. Silakan masuk menggunakan akun Anda.";
            message.className = "form-message success";
            form.reset();
            setBusy(button, false);
            window.setTimeout(function () { window.location.assign(window.MEDICFLOW_LOGIN_URL); }, 1400);
        } catch (error) {
            message.textContent = error.message;
            setBusy(button, false);
        }
    });
}


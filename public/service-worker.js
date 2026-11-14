"use strict";

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    event.waitUntil((async function () {
        const targetUrl = new URL(event.notification.data && event.notification.data.url || "/index.php/app", self.location.origin).href;
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

        for (const client of windows) {
            if (client.url.startsWith(self.location.origin)) {
                client.postMessage({ type: "medicflow-notification-click" });
                return client.focus();
            }
        }

        return self.clients.openWindow(targetUrl);
    })());
});

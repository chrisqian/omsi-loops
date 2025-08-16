// @ts-check
// Google cloud stuff

class GoogleCloud {
    static #CLIENT_ID = "550385076459-ek9ul9e3oo7ootou8bplmfjhfof1nntn.apps.googleusercontent.com";

    scope = "https://www.googleapis.com/auth/drive.appdata";

    /** @type {google.accounts.oauth2.TokenResponse} */
    tokenResponse;
    /** @type {google.accounts.oauth2.ClientConfigError} */
    tokenError;
    /** @type {number} */
    tokenExpiry;
    /** @type {google.accounts.oauth2.TokenClient} */
    tokenClient;

    gapiLoaded = false;
    /** @type {Promise} */
    #authzPromise = null;

    /** @type {(success: boolean) => void} */
    #tokenHandler;

    async init() {
        if (!window.google || !window.gapi) {
            let timeoutCounter = 100; // 10 seconds
            console.log("Waiting on gapi and gsi to load...");
            while (!window.google || !window.gapi) {
                await delay(100);
                if (timeoutCounter-- === 0) {
                    console.error("Google API taking a long time to load? Hopefully waiting longer fixes it");
                }
            }
        }
        this.tokenClient ??= google.accounts.oauth2.initTokenClient({
            client_id: GoogleCloud.#CLIENT_ID,
            scope: this.scope,
            callback: (response) => this.#handleToken(response),
            error_callback: (error) => this.#handleTokenError(error),
        });
        if (!gapi?.client?.drive) {
            while (!gapi) {
                console.error("gapi not loaded? something has gone wrong, hopefully waiting fixes it");
                await delay(1000);
            }
            await new Promise((callback, onerror) => gapi.load("client", {callback, onerror}));
            await gapi.client.init({
                discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
            });
            this.gapiLoaded = true;
        }
    }

    revoke() {
        if (gapi?.client?.getToken() != null) {
            console.log("revoking cloud auth");
            google.accounts.oauth2.revoke(this.tokenResponse.access_token, () => {
                gapi.client.setToken(null);
            });
        }
    }

    async authorize(userRequest) {
        console.log("starting authorize for",{userRequest,promise:this.#authzPromise,token:gapi.client.getToken(),expiry:this.tokenExpiry});
        this.#authzPromise ??= this.init().then(
            () => new Promise((resolve, reject) => {
                if (userRequest && (gapi.client.getToken() == null || Date.now() > this.tokenExpiry)) {
                    console.log("requesting access token");
                    this.#tokenHandler = success => success ? resolve(this.tokenResponse?.access_token) : reject(this.tokenError?.message);
                    this.tokenClient.requestAccessToken({
                        prompt: "",
                    });
                } else {
                    gapi.client.request({path: '/oauth2/v1/tokeninfo'}).then(resolve, reject);
                }
            }).catch((reason) => {
                gapi.client.setToken(null);
                return Promise.reject(reason);
            })
        ).finally(() => {
            this.#authzPromise = null;
        }).catch((reason) => {
            console.error(`Google Drive initialization failed during ${userRequest}:`, reason);
            return false;
        });
        return this.#authzPromise;
    }

    uploadFile(metadata, mimeType, data) {
        const boundary = 'IdleLoops';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        
        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify({mimeType, ...metadata}) +
            delimiter +
            'Content-Type: ' + mimeType + '\r\n\r\n' +
            data +
            close_delim;
        
        return gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: {uploadType: "multipart"},
            headers: {
                "Content-Type": `multipart/related; boundary="${boundary}"`,
            },
            body: multipartRequestBody
        });
    }

    async deleteFile(fileId) {
        if (!await this.authorize("delete")) return;
        console.log("performing cloud delete");
        await gapi.client.drive.files.delete({
            fileId,
        });
        view.requestUpdate("updateCloudSave", {id: fileId});
    }

    async renameFile(fileId, newName) {
        if (!await this.authorize("rename")) return;
        console.log("performing cloud rename");
        const response = await gapi.client.drive.files.update({
            fileId,
            resource: {
                name: newName,
            },
        });
        if (response.result) view.requestUpdate("updateCloudSave", response.result);
    }

    async importFile(fileId) {
        if (!await this.authorize("import")) return;
        console.log("performing cloud import");
        const response = await gapi.client.drive.files.get({fileId,alt:"media"});
        // console.log("got response:",response);
        processSave(response.body);
    }

    async exportSave() {
        if (!await this.authorize("save")) return;
        console.log("performing cloud save");
        save();
        const data = currentSaveData();
        const name = saveFileName().replace(".txt","");
        await this.uploadFile({
            name,
            parents: ["appDataFolder"],
        }, "text/plain", data);
        view.requestUpdate("updateCloudSave", _txt("menu>save>cloud_saved").replace("{name}", name));
        console.log("cloud save complete, waiting and then triggering optimistic reload");
        await delay(1000);
        this.loadSaves(false);
    }

    async loadSaves(fromUserRequest) {
        if (!await this.authorize(fromUserRequest && "load")) return;
        console.log("performing cloud load");
        const response = await gapi.client.drive.files.list({
            spaces: "appDataFolder",
            fields: "files(id,name)",
        });
        view.requestUpdate("updateCloudSave", ""); // clear the list
        for (const file of response.result?.files) {
            view.requestUpdate("updateCloudSave", file);
        }
    }

    /** @param {google.accounts.oauth2.TokenResponse} response  */
    #handleToken(response) {
        console.log("Got token response:",response);
        this.tokenResponse = response;
        this.tokenError = null;
        this.tokenExpiry = parseInt(response?.expires_in) * 1000 + Date.now();

        this.#tokenHandler?.(google.accounts.oauth2.hasGrantedAllScopes(response, this.scope));
        this.#tokenHandler = null;
    }

    /** @param {google.accounts.oauth2.ClientConfigError} error  */
    #handleTokenError(error) {
        console.log("Got token error:",error);
        this.tokenResponse = null;
        this.tokenError = error;
        this.tokenExpiry = 0;
        this.#tokenHandler?.(false);
        this.#tokenHandler = null;
    }
}



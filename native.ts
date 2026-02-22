import { Server } from "http";
import { json } from "stream/consumers";
import { type Song, getDuration } from "./song";
import { IpcMainInvokeEvent } from "electron";
import { Logger } from "@utils/Logger";
import { RendererSettings } from "@main/settings";

type WebhookRequest = {
    eventName: string;
    time: number;
    data: {
        song: Song;
        songs?: Song[];
        isLoved?: boolean;
        currentlyPlaying?: boolean;
    };
};

let reset: NodeJS.Timeout | undefined;

let server: Server | null = null;

async function wait_for_close() {
    await new Promise(res => {
        server?.once('close', res);
    });
}

let old_settings;
export async function start(_: IpcMainInvokeEvent, settings: { port?: number, host?: string, proxy?: string; }) {
    if (old_settings?.port == settings.port && old_settings?.host == settings.host && old_settings?.proxy == settings.proxy) {
        console.log("identical settings, i shall return early and not bother the running server");
        return;
    }
    console.log("different settings?", JSON.stringify(old_settings), JSON.stringify(settings));
    if (server && server.listening) {
        server.close();
        await wait_for_close();
    }
    if (!settings.port) {
        server = null;
        old_settings = null;
        return;
    }
    old_settings = settings;
    async function updateSongInfo(time: number, song?: Song) {
        let arg = song ? { song, time } : null;
        await _.sender.executeJavaScript(`Vencord.Plugins.plugins.ScrobbleRPC.updateSongInfo(${JSON.stringify(arg)})`)
            .catch((reason) => {
                server?.close();
                console.error("oh nor", reason);
            });
    }
    server = make_server(updateSongInfo);
    const { port, host, proxy } = settings;
    console.log("listening:", port, host);
    server.listen(port, host?.length === 0 ? undefined : host);

    await wait_for_close();
    console.log("i am being overwritten");
}

export async function stop(_: IpcMainInvokeEvent) {
    await start(_, {});
}

function make_server(cb: (time: number, song?: Song) => Promise<void>): Server {
    return new Server(async (req, res) => {
        const req_data = await json(req).catch((reason) => {
            res.writeHead(400)
                .end(JSON.stringify({ "error": reason }));
        }) as WebhookRequest;

        res.writeHead(200).end();

        console.log("got from scrobbler", req_data.eventName, req_data.data.song);

        let stopped = false;
        switch (req_data?.eventName) {
            case "paused":
                stopped = true;
            case "resumedplaying":
            case "nowplaying":
                // continue
                break;
            case "scrobble":
            case "loved":
            default:
                return;
        }

        clearTimeout(reset);
        const duration = getDuration(req_data.data.song);
        const now = Date.now();
        if (stopped) {
            await cb(req_data.time);
            return;
        }
        const time = req_data.data.song.metadata.startTimestamp ? req_data.data.song.metadata.startTimestamp * 1000 : req_data.time;
        if (duration && duration * 1000 + time >= now) {
            reset = setTimeout(async () => {
                reset = undefined;
                await cb(req_data.time);
            }, duration * 1000 + time - now);
        }

        await cb(req_data.time, req_data.data.song);
    });
}


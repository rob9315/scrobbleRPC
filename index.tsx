/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Divider } from "@components/Divider";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Devs } from "@utils/constants";
import { isTruthy } from "@utils/guards";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import { ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findComponentByCodeLazy } from "@webpack";
import { ApplicationAssetUtils, Button, FluxDispatcher, Forms, React, UserStore } from "@webpack/common";

import { RPCSettings, updateRPC } from "./RpcSettings";
import { getAlbum, getAlbumArtist, getArtist, getDuration, getTrack, getTrackArt, Song } from "./song";

const useProfileThemeStyle = findByCodeLazy("profileThemeStyle:", "--profile-gradient-primary-color");
const ActivityView = findComponentByCodeLazy(".party?(0", "USER_PROFILE_ACTIVITY");

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(settings.store.appID!, [key]))[0];
}

export const settings = definePluginSettings({
    config: {
        type: OptionType.COMPONENT,
        component: RPCSettings
    },
}).withPrivateSettings<{
    appID?: string;
    appName?: string;
    host?: string;
    port?: number;
    proxy?: string;
    buttonOneText?: string;
    buttonOneURL?: string;
    buttonTwoText?: string;
    buttonTwoURL?: string;
}>();


type SongInfo = {
    song: Song;
    time: number;
};
let song_info: SongInfo | null = null;

export function updateSongInfo(info: SongInfo | null) {
    song_info = info;
    updateRPC();
}

async function createActivity(): Promise<Activity | undefined> {
    const {
        appID,
        appName,
        buttonOneText,
        buttonOneURL,
        buttonTwoText,
        buttonTwoURL,
    } = settings.store;

    if (!song_info) return;
    const { song, time } = song_info;

    const activity: Activity = {
        application_id: appID || "0",
        name: appName?.length != 0 ? appName! : `music on ${song.metadata.label}`,
        state: getArtist(song) ?? undefined, // artist
        details: getTrack(song) ?? "track goes here", // track
        type: ActivityType.LISTENING,
        status_display_type: ActivityStatusDisplayType.DETAILS,
        timestamps: { start: song.metadata.startTimestamp ? song.metadata.startTimestamp * 1000 : time },
        flags: 1 << 0,
    };

    let duration = getDuration(song);
    if (duration) {
        activity.timestamps!.end = activity.timestamps!.start! + duration * 1000;
    }

    if (song.metadata.trackUrl) {
        activity.details_url = song.metadata.trackUrl;
    }

    if (song.metadata.artistUrl) {
        activity.state_url = song.metadata.artistUrl;
    }

    if (buttonOneText) {
        activity.buttons = [
            buttonOneText,
            buttonTwoText
        ].filter(isTruthy);

        activity.metadata = {
            button_urls: [
                buttonOneURL,
                buttonTwoURL
            ].filter(isTruthy)
        };
    }

    const track_img = getTrackArt(song);
    if (track_img) {
        const album = getAlbum(song);
        const albumArtist = getAlbumArtist(song);
        // const tooltip = ;
        // (album != getTrack(song) ? (!!album && !!albumArtist) ? `${albumArtist} - ${album}`
        //     : (album ? album : `${activity.state} - ${activity.details}`) : undefined);
        activity.assets = {
            large_image: await getApplicationAsset(track_img),
            large_text: album ?? undefined,
            large_url: song.parsed.originUrl ?? (album != getTrack(song) ? song.metadata.albumUrl : null) ?? song.metadata.trackUrl ?? undefined,
        };
    }

    // if (imageSmall) {
    //     activity.assets = {
    //         ...activity.assets,
    //         small_image: await getApplicationAsset(imageSmall),
    //         small_text: imageSmallTooltip || undefined,
    //         small_url: imageSmallURL || undefined
    //     };
    // }

    // if (partyMaxSize && partySize) {
    //     activity.party = {
    //         size: [partySize, partyMaxSize]
    //     };
    // }

    for (const k in activity) {
        if (k === "type") continue;
        const v = activity[k];
        if (!v || v.length === 0)
            delete activity[k];
    }

    console.log("activity:", JSON.stringify(activity, undefined, 2));

    return activity;
}

export async function setRpc(disable?: boolean) {
    const activity: Activity | undefined = await createActivity();

    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity: !disable ? activity : null,
        socketId: "CustomRPC",
    });
}

export const Native = VencordNative.pluginHelpers.ScrobbleRPC as PluginNative<typeof import("./native")>;
export default definePlugin({
    name: "ScrobbleRPC",
    description: "Rich Presence (Music Status) based on scrobbling input",
    authors: [Devs.captain, Devs.AutumnVN, Devs.nin0dev, { name: "rob9315", id: 241801234091212802n }],
    dependencies: ["UserSettingsAPI"],
    // This plugin's patch is not important for functionality, so don't require a restart
    requiresRestart: false,
    settings,
    updateSongInfo,

    start: () => Native.start({
        port: settings.store.port,
        host: settings.store.host,
        proxy: settings.store.proxy,
    }),
    stop: () => Native.stop(),

    // Discord hides buttons on your own Rich Presence for some reason. This patch disables that behaviour
    patches: [
        {
            find: ".USER_PROFILE_ACTIVITY_BUTTONS),",
            replacement: {
                match: /.getId\(\)===\i.id/,
                replace: "$& && false"
            }
        }
    ],

    settingsAboutComponent: () => {
        const [activity] = useAwaiter(createActivity, { fallbackValue: undefined, deps: Object.values(settings.store) });
        const gameActivityEnabled = ShowCurrentGame.useSetting();
        const { profileThemeStyle } = useProfileThemeStyle({});

        return (
            <>
                {!gameActivityEnabled && (
                    <ErrorCard
                        className={classes(Margins.top16, Margins.bottom16)}
                        style={{ padding: "1em" }}
                    >
                        <Forms.FormTitle>Notice</Forms.FormTitle>
                        <Forms.FormText>Activity Sharing isn't enabled, people won't be able to see your custom rich presence!</Forms.FormText>

                        <Button
                            color={Button.Colors.TRANSPARENT}
                            className={Margins.top8}
                            onClick={() => ShowCurrentGame.updateSetting(true)}
                        >
                            Enable
                        </Button>
                    </ErrorCard>
                )}

                <Flex flexDirection="column" gap=".5em" className={Margins.top16}>
                    <Forms.FormText>
                        Go to the <Link href="https://discord.com/developers/applications">Discord Developer Portal</Link> to create an application and
                        get the application ID.
                    </Forms.FormText>
                    <Forms.FormText>
                        You can't see your own buttons on your profile, but everyone else can see it fine.
                    </Forms.FormText>
                    <Forms.FormText>
                        Some weird unicode text ("fonts" 𝖑𝖎𝖐𝖊 𝖙𝖍𝖎𝖘) may cause the rich presence to not show up, try using normal letters instead.
                    </Forms.FormText>
                </Flex>

                <Divider className={Margins.top8} />

                <div style={{ width: "284px", ...profileThemeStyle, marginTop: 8, borderRadius: 8, background: "var(--background-mod-muted)" }}>
                    {activity && <ActivityView
                        activity={activity}
                        user={UserStore.getCurrentUser()}
                        currentUser={UserStore.getCurrentUser()}
                    />}
                </div>
            </>
        );
    }
});

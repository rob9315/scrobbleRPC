/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./settings.css";

import { isPluginEnabled } from "@api/PluginManager";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { resolveError } from "@components/settings/tabs/plugins/components/Common";
import { debounce } from "@shared/debounce";
import { classNameFactory } from "@utils/css";
import { ActivityType } from "@vencord/discord-types/enums";
import { Select, Text, TextInput, useState } from "@webpack/common";

import ScrobbleRPCPlugin, { setRpc, settings, Native } from ".";

const cl = classNameFactory("vc-customRPC-settings-");

type SettingsKey = keyof typeof settings.store;

interface TextOption<T> {
    settingsKey: SettingsKey;
    label: string;
    disabled?: boolean;
    transform?: (value: string) => T;
    isValid?: (value: T) => true | string;
}

interface SelectOption<T> {
    settingsKey: SettingsKey;
    label: string;
    disabled?: boolean;
    options: { label: string; value: T; default?: boolean; }[];
}

const makeValidator = (maxLength: number, isRequired = false) => (value: string) => {
    if (isRequired && !value) return "This field is required.";
    if (value.length > maxLength) return `Must be not longer than ${maxLength} characters.`;
    return true;
};

const maxLength128 = makeValidator(128);

function isAppIdValid(value: string) {
    if (!/^\d{16,21}$/.test(value)) return "Must be a valid Discord ID.";
    return true;
}

export const updateConfig = debounce(() => {
    Native.start({
        port: settings.store.port,
        host: settings.store.host,
        proxy: settings.store.proxy,
    }); // can be long-running
    updateRPC();
});

export const updateRPC = debounce(() => {
    if (isPluginEnabled(ScrobbleRPCPlugin.name)) setRpc();
    else setRpc(true);
});

function parseNumber(value: string) {
    return value ? parseInt(value, 10) : 0;
}

function isNumberValid(value: number) {
    if (isNaN(value)) return "Must be a number.";
    if (value < 0) return "Must be a positive number.";
    return true;
}

function isUrlValid(value: string) {
    if (value && !/^https?:\/\/.+/.test(value)) return "Must be a valid URL.";
    return true;
}

function PairSetting<T, U>(props: { data: [TextOption<T>, TextOption<U>]; }) {
    const [left, right] = props.data;

    return (
        <div className={cl("pair")}>
            <SingleSetting {...left} />
            <SingleSetting {...right} />
        </div>
    );
}

function SingleSetting<T>({ settingsKey, label, disabled, isValid, transform }: TextOption<T>) {
    const [state, setState] = useState(settings.store[settingsKey] ?? "");
    const [error, setError] = useState<string | null>(null);

    function handleChange(newValue: any) {
        if (transform) newValue = transform(newValue);

        const valid = isValid?.(newValue) ?? true;

        setState(newValue);
        setError(resolveError(valid));

        if (valid === true) {
            settings.store[settingsKey] = newValue;
            updateConfig();
        }
    }

    return (
        <div className={cl("single", { disabled })}>
            <Heading tag="h5">{label}</Heading>
            <TextInput
                type="text"
                placeholder={"Enter a value"}
                value={state}
                onChange={handleChange}
                disabled={disabled}
            />
            {error && <Text className={cl("error")} variant="text-sm/normal">{error}</Text>}
        </div>
    );
}

// function SelectSetting<T>({ settingsKey, label, options, disabled }: SelectOption<T>) {
//     return (
//         <div className={cl("single", { disabled })}>
//             <Heading tag="h5">{label}</Heading>
//             <Select
//                 placeholder={"Select an option"}
//                 options={options}
//                 maxVisibleItems={5}
//                 closeOnSelect={true}
//                 select={v => settings.store[settingsKey] = v}
//                 isSelected={v => v === settings.store[settingsKey]}
//                 serialize={v => String(v)}
//                 isDisabled={disabled}
//             />
//         </div>
//     );
// }

export function RPCSettings() {
    const s = settings.use();

    return (
        <div className={cl("root")}>

            <PairSetting data={[
                { settingsKey: "appID", label: "Application ID", isValid: isAppIdValid },
                { settingsKey: "appName", label: "Application Name", isValid: maxLength128 },
            ]} />

            {/* <Divider /> */}

            {/* <PairSetting data={[
                { settingsKey: "imageBig", label: "Large Image URL/Key", isValid: isImageKeyValid },
                { settingsKey: "imageBigTooltip", label: "Large Image Text", isValid: maxLength128 },
            ]} />
            <SingleSetting settingsKey="imageBigURL" label="Large Image clickable URL" isValid={isUrlValid} /> */}

            {/* <PairSetting data={[
                { settingsKey: "imageSmall", label: "Small Image URL/Key", isValid: isImageKeyValid },
                { settingsKey: "imageSmallTooltip", label: "Small Image Text", isValid: maxLength128 },
            ]} />
            <SingleSetting settingsKey="imageSmallURL" label="Small Image clickable URL" isValid={isUrlValid} /> */}

            <PairSetting data={[
                { settingsKey: "host", label: "host (optional)", isValid: () => true },
                { settingsKey: "port", label: "port to bind", transform: parseNumber, isValid: isNumberValid },
            ]} />
            <SingleSetting settingsKey="proxy" label="proxy url (optional)" isValid={isUrlValid} />

            <Divider />

            <PairSetting data={[
                { settingsKey: "buttonOneText", label: "Button1 Text", isValid: makeValidator(31) },
                { settingsKey: "buttonOneURL", label: "Button1 URL", isValid: isUrlValid },
            ]} />
            <PairSetting data={[
                { settingsKey: "buttonTwoText", label: "Button2 Text", isValid: makeValidator(31) },
                { settingsKey: "buttonTwoURL", label: "Button2 URL", isValid: isUrlValid },
            ]} />
        </div>
    );
}

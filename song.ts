export interface ConnectorMeta {
	label: string;
	matches: string[];
	js: string;
	id: string;
	allFrames?: true;

	/**
	 * true if connector uses blocklist. Connector must implement {@link Connector.getChannelId}
	 */
	usesBlocklist?: true;

	/**
	 * true if website has its own scrobbling system the user needs to be aware of.
	 */
	hasNativeScrobbler?: true;
}

/**
 * Reasons why a scrobble could be disallowed
 */
export type DisallowedReason =
	/**
	 * Current track is an ad
	 */
	| 'IsAd'

	/**
	 * YouTube category **the user** has disabled
	 */
	| 'ForbiddenYouTubeCategory'

	/**
	 * Artist/album/track tag **the user** has disabled
	 * For tags that are always disabled in the connector, use 'FilteredTag'
	 */
	| 'ForbiddenTag'

	/**
	 * Playing from a channel **the user** has disabled
	 */
	| 'ForbiddenChannel'

	/**
	 * Not recognized as music by YTM despite user setting demanding it
	 */
	| 'NotOnYouTubeMusic'

	/**
	 * Web scrobbler thinks this song is playing on a different device
	 */
	| 'IsPlayingElsewhere'

	/**
	 * Some element web scrobbler relies on is missing
	 */
	| 'ElementMissing'

	/**
	 * Tags contain some term that is filtered **on website**
	 * For tags disabled by the user, use 'ForbiddenTag'
	 */
	| 'FilteredTag'

	/**
	 * Something crucial to detection is still loading
	 * This error will normally be temporary, usually pretty quickly resolved
	 */
	| 'IsLoading'

	/**
	 * The track has been made private and shared by the owner.
	 * Currently used for Soundcloud only.
	 */
	| 'IsPrivate'

	/**
	 * Any other reason
	 */
	| 'Other';

export interface ProcessedSongData {
	artist?: string | null;
	album?: string | null;
	albumArtist?: string | null;
	track?: string | null;
	duration?: number | null;
}

export interface ParsedSongData extends ProcessedSongData {
	trackArt?: string | null;
	uniqueID?: string | null;
	originUrl?: string | null;
	isPodcast?: boolean | null;
	isPlaying?: boolean | null;
	currentTime?: number | null;
	scrobblingDisallowedReason?: DisallowedReason | null;
}

export type Flags =
	| {
		isScrobbled: boolean;
		isCorrectedByUser: boolean;
		isRegexEditedByUser: {
			track: boolean;
			artist: boolean;
			album: boolean;
			albumArtist: boolean;
		};
		isAlbumFetched: boolean;
		isValid: boolean;
		isMarkedAsPlaying: boolean;
		isSkipped: boolean;
		isReplaying: boolean;
		hasBlockedTag: boolean;
		isLovedInService: boolean | null;
		finishedProcessing: boolean;
	}
	| Record<string, never>;

export type Metadata =
	| {
		label: string;
		startTimestamp: number;

		albumMbId?: string;
		albumUrl?: string;
		artistUrl?: string;
		notificationId?: string;
		trackArtUrl?: string;
		trackUrl?: string;
		userPlayCount?: number;
		userloved?: boolean;
	}
	| Record<string, never>;

/**
 * Song object.
 */
export interface Song {
	parsed: ParsedSongData;
	processed: ProcessedSongData;
	noRegex: ProcessedSongData;
	flags: Flags;
	metadata: Metadata;
	connector: ConnectorMeta;
}

/**
 * Get song artist.
 *
 * @returns Song artist
 */
export function getArtist(self: Song): string | null | undefined {
	return self.processed.artist ?? self.parsed.artist;
}

/**
 * Get song title.
 *
 * @returns Song title
 */
export function getTrack(self: Song): string | null | undefined {
	return self.processed.track ?? self.parsed.track;
}

/**
 * Get song album.
 *
 * @returns Song album
 */
export function getAlbum(self: Song): string | null | undefined {
	return self.processed.album ?? self.parsed.album;
}

/**
 * Return song's album artist (Optional)
 * @returns Album artist
 */
export function getAlbumArtist(self: Song): string | null | undefined {
	return self.processed.albumArtist ?? self.parsed.albumArtist;
}

/**
 * Returns song's processed or parsed duration in seconds.
 * Parsed duration (received from connector) is preferred.
 *
 * @returns Song duration
 */
export function getDuration(self: Song): number | null | undefined {
	return self.parsed.duration ?? self.processed.duration;
}

/**
 * Return the track art URL associated with the song.
 * Parsed track art (received from connector) is preferred.
 *
 * @returns Track art URL
 */
export function getTrackArt(self: Song): string | null {
	return self.parsed.trackArt ?? self.metadata.trackArtUrl ?? null;
}

/**
 * Return if the Track is loved.
 *
 * @returns Track loved
 */
export function isLoved(self: Song): boolean | null {
	return self.metadata.userloved ?? null;
}

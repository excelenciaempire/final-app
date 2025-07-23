// For lucide-react-native, @react-native-picker/picker, @react-navigation/material-top-tabs, expo-clipboard
declare module 'lucide-react-native';
declare module '@react-native-picker/picker';
declare module '@react-navigation/material-top-tabs';
declare module 'expo-clipboard';

// For @clerk/clerk-expo
declare module '@clerk/clerk-expo' {
    export function useAuth(): {
        getToken: (options?: { template?: string }) => Promise<string | null>;
        userId: string | null;
        sessionId: string | null;
        isSignedIn: boolean;
        isLoaded: boolean;
    };
    export function useUser(): {
        user: {
            unsafeMetadata: {
                [key: string]: any;
            };
            [key: string]: any;
        } | null;
        isSignedIn: boolean;
        isLoaded: boolean;
    };
}

// For expo-image-picker
declare module 'expo-image-picker' {
    export enum MediaTypeOptions {
        All = 'All',
        Videos = 'Videos',
        Images = 'Images',
    }

    export interface ImagePickerAsset {
        uri: string;
        base64?: string;
        [key: string]: any;
    }
    export interface ImagePickerResult {
        canceled: boolean;
        assets: ImagePickerAsset[] | null;
    }
    export function launchImageLibraryAsync(options?: any): Promise<ImagePickerResult>;
    export function launchCameraAsync(options?: any): Promise<ImagePickerResult>;
    export function requestCameraPermissionsAsync(): Promise<any>;
    export function requestMediaLibraryPermissionsAsync(): Promise<any>;
}

// For expo-av
declare module 'expo-av' {
    export enum InterruptionModeIOS {
        MixWithOthers = 0,
        DoNotMix = 1,
        DuckOthers = 2,
    }
    export enum InterruptionModeAndroid {
        DoNotMix = 1,
        DuckOthers = 2,
    }
    export namespace Audio {
        export enum AndroidOutputFormat {
            DEFAULT = 0,
            THREE_GPP = 1,
            MPEG_4 = 2,
            AMR_NB = 3,
            AMR_WB = 4,
            AAC_ADIF = 5,
            AAC_ADTS = 6,
            RTP_AVP = 7,
            MPEG2_TS = 8,
            WEBM = 9,
        }
        export enum AndroidAudioEncoder {
            DEFAULT = 0,
            AMR_NB = 1,
            AMR_WB = 2,
            AAC = 3,
            HE_AAC = 4,
            AAC_ELD = 5,
            VORBIS = 6,
        }
        export enum IOSOutputFormat {
            LINEARPCM = 'lpcm',
            AC3 = 'ac-3',
            '60958' = 'cac3',
            APPLEIMA4 = 'ima4',
            MPEG4AAC = 'aac ',
            MPEG4CELP = 'celp',
            MPEG4HVXC = 'hvxc',
            MPEG4TWINVQ = 'twvq',
            MACE3 = 'MAC3',
            MACE6 = 'MAC6',
            ULAW = 'ulaw',
            ALAW = 'alaw',
            QDESIGN = 'QDMC',
            QDESIGN2 = 'QDM2',
            QUALCOMM = 'Qclp',
            MPEGLAYER1 = '.mp1',
            MPEGLAYER2 = '.mp2',
            MPEGLAYER3 = '.mp3',
            APPLELOSSLESS = 'alac',
            MPEG4AAC_HE = 'aach',
            MPEG4AAC_LD = 'aacl',
            MPEG4AAC_ELD = 'aace',
            MPEG4AAC_ELD_SBR = 'aacf',
            MPEG4AAC_ELD_V2 = 'aacg',
            MPEG4AAC_HE_V2 = 'aahp',
            MPEG4AAC_SPATIAL = 'aacs',
            AMR = 'samr',
            AMR_WB = 'sawb',
            AUDIBLE = 'auD2',
            ILBC = 'ilbc',
            DVIINTELIMA = 1836253201,
            MICROSOFTGSM = 1836253233,
            AES3 = 'aes3',
            ENHANCEDAC3 = 'ec-3',
        }
        export enum IOSAudioQuality {
            MIN = 0,
            LOW = 32,
            MEDIUM = 64,
            HIGH = 96,
            MAX = 127,
        }
        export class Recording {
            _subscription: any | null;
            _canRecord: boolean;
            _isDoneRecording: boolean;
            _finalDurationMillis: number;
            getStatusAsync(): Promise<any>;
            getURI(): string | null;
            prepareToRecordAsync(options: any): Promise<any>;
            startAsync(): Promise<any>;
            stopAndUnloadAsync(): Promise<any>;
        }
        export const RecordingOptionsPresets: {
            HIGH_QUALITY: any;
        };
        export function requestPermissionsAsync(): Promise<any>;
        export function setAudioModeAsync(options: any): Promise<any>;
    }
}


declare namespace JSX {
    interface IntrinsicElements {
        div: any;
    }
} 
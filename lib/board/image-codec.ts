import { encodePrivateImage } from "../images/codec.ts";
import { BOARD_IMAGES } from "./image-policy.ts";
export { ImageInputError } from "../images/codec.ts";
export function encodeBoardImage(bytes: Uint8Array, declaredType: string) { return encodePrivateImage(bytes, declaredType, BOARD_IMAGES); }

import {randomBytes,createHmac} from  'crypto';

function getAuthorizationScheme() { return "VERACODE-HMAC-SHA-256"; }
function getRequestVersion() { return "vcode_request_version_1"; }
function getNonceSize() { return 16; }

function hmac256 (data:string|Int8Array, key:string|Buffer|Int8Array, format:"hex"|undefined)  {
    let hash = createHmac('sha256', key).update(data);
    if (format===undefined){
        return hash.digest();
    } else {
        // no format = Buffer / byte array
        return hash.digest(format);
    }
}

function getByteArray(hex:string)  {
	var bytes = [] as any;

	for(var i = 0; i < hex.length-1; i+=2){
	    bytes.push(parseInt(hex.substr(i, 2), 16));
	}

	// signed 8-bit integer array (byte array)
	return Int8Array.from(bytes);
}


export function generateHeader (id:string, secret:string,host:string, urlPath:string,urlQueryParams: string, method:string) {
    urlPath += urlQueryParams;
    var data = `id=${id}&host=${host}&url=${urlPath}&method=${method}`;
	var timestamp = (new Date().getTime()).toString();
	var nonce = randomBytes(getNonceSize()).toString("hex");

	// calculate signature
	var hashedNonce = hmac256(getByteArray(nonce), getByteArray(secret),undefined);
	var hashedTimestamp = hmac256(timestamp, hashedNonce,undefined);
	var hashedVerStr = hmac256(getRequestVersion(), hashedTimestamp,undefined);
	var signature = hmac256(data, hashedVerStr, "hex");

	return `${getAuthorizationScheme()} id=${id},ts=${timestamp},nonce=${nonce},sig=${signature}`;
}


import CryptoKit
import Foundation

struct SignalingCipher {
    private let key: SymmetricKey

    init(pairingSecret: Data) {
        key = SymmetricKey(data: SHA256.hash(data: pairingSecret))
    }

    func seal<T: Encodable>(_ value: T) throws -> (ciphertext: Data, nonce: Data) {
        let encoded = try JSONEncoder.safety.encode(value)
        let sealedBox = try AES.GCM.seal(encoded, using: key)
        let nonceData = sealedBox.nonce.withUnsafeBytes { Data($0) }
        guard let ciphertext = sealedBox.combined else {
            throw CryptoError.sealFailed
        }
        return (ciphertext, nonceData)
    }

    func open<T: Decodable>(_ type: T.Type, ciphertext: Data) throws -> T {
        let sealedBox = try AES.GCM.SealedBox(combined: ciphertext)
        let plaintext = try AES.GCM.open(sealedBox, using: key)
        return try JSONDecoder.safety.decode(type, from: plaintext)
    }
}

enum CryptoError: Error {
    case sealFailed
}

extension JSONEncoder {
    static var safety: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

extension JSONDecoder {
    static var safety: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}

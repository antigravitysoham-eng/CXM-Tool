import 'dotenv/config';

// Centralised config. Secrets come from the environment (.env locally);
// there is no hardcoded fallback for JWT_SECRET so a missing secret fails loud.
if (!process.env.JWT_SECRET) {
    throw new Error(
        'JWT_SECRET is not set. Copy server/.env.example to server/.env and set a value ' +
        '(node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").'
    );
}

export const config = {
    port: Number(process.env.PORT) || 5000,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    fxUsdInr: Number(process.env.FX_USD_INR) || 83
};

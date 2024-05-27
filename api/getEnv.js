module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allows any domain
    res.json({
        api: process.env.API_KEY,
        client: process.env.CLIENT_ID,
    });
};
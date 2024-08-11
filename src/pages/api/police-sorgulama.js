import FormData from 'form-data';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const DOMParser = new JSDOM().window.DOMParser;

async function solveCaptcha() {
    const apiKey = '34f04c14a6b615e0bfcbf99a83f54a35';
    const captchaResponse = await fetch('https://2captcha.com/in.php', {
        method: 'POST',
        body: new URLSearchParams({
            key: apiKey,
            method: 'userrecaptcha',
            googlekey: '6Levh-8UAAAAADKgSrLuFDo1PNopWkk-Ife5Im8y',
            pageurl: 'https://dask.gov.tr/tr/police-sorgulama'
        })
    });

    const captchaResponseText = await captchaResponse.text();
    const captchaId = captchaResponseText.split('|')[1];
    if (!captchaId) {
        throw new Error('Captcha ID alınamadı');
    }

    await new Promise(resolve => setTimeout(resolve, 20000));

    let captchaResultResponse;
    let retries = 100;
    while (retries > 0) {
        captchaResultResponse = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}`);
        const captchaResultText = await captchaResultResponse.text();

        if (captchaResultText.includes('CAPCHA_NOT_READY')) {
            retries--;
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            if (captchaResultText.includes('ERROR') || retries === 0) {
                throw new Error(`Captcha çözme hatası: ${captchaResultText}`);
            }
            return captchaResultText.split('|')[1];
        }
    }
}

function parseCookies(cookies) {
    return cookies.map(cookie => {
        const parts = cookie.split(';');
        const [name, value] = parts[0].split('=');

        const cookieObj = { name: name.trim(), value: value.trim() };

        parts.slice(1).forEach(part => {
            const [key, val] = part.split('=');
            const trimmedKey = key.trim().toLowerCase();
            if (trimmedKey === 'secure' || trimmedKey === 'httponly') {
                cookieObj[trimmedKey] = true;
            } else {
                cookieObj[trimmedKey] = val ? val.trim() : true;
            }
        });

        return cookieObj;
    });
}

function getLastCookieValues(cookies, cookieName) {
    const parsedCookies = parseCookies(cookies);
    const matchingCookies = parsedCookies.filter(cookie => cookie.name === cookieName);
    return matchingCookies.length > 0 ? matchingCookies[matchingCookies.length - 1].value : null;
}

function extractTokenValue(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const inputElement = doc.querySelector('form[action="/tr/arama-sonuclari"] input[name="__RequestVerificationToken"]');
    return inputElement ? inputElement.value : null;
}

async function fetchPageText() {
    try {
        const response = await fetch('https://dask.gov.tr/tr/police-sorgulama', {
            method: 'GET',
            headers: {
                'Content-Type': 'text/html',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const cookies = response.headers.raw()['set-cookie'];
        const pageText = await response.text();

        return { cookies, pageText };
    } catch (error) {
        console.error(`Failed to fetch page text: ${error.message}`);
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        var { identityNo, cityCode, districtCode } = req.body;

        console.log(`${new Date().toLocaleTimeString('en-GB', { hour12: false })} - Sorgu başlatıldı: ${identityNo}, ${cityCode}, ${districtCode}`);


        const startTime = new Date();
        try {
            console.log(`${startTime.toISOString()} - İstek atıldı.`);

            const { cookies, pageText } = await fetchPageText();

            const formToken = extractTokenValue(pageText);
            const lastHeaderSessionId = getLastCookieValues(cookies, 'ASP.NET_SessionId');
            const lastHeaderRequestVerificationToken = getLastCookieValues(cookies, '__RequestVerificationToken');

            console.log(`${new Date().toLocaleTimeString('en-GB', { hour12: false })} - Cookie: ASP.NET_SessionId=${lastHeaderSessionId}`);

            const captchaStartTime = new Date().toLocaleTimeString('en-GB', { hour12: false });
            const gRecaptchaResponse = await solveCaptcha();
            console.log(`${captchaStartTime} - Captcha çözüldü: ${gRecaptchaResponse}`);

            const captchaEndTime = new Date();
            console.log(`${captchaEndTime.toISOString()} - Captcha çözüldü.`);

            const url = "https://dask.gov.tr/tr/PolicyServices/IdentityCityDistrictCount";
            const headers = {
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-GB,en;q=0.9,tr;q=0.8,az;q=0.7",
                "Origin": "https://dask.gov.tr",
                "Referer": "https://dask.gov.tr/tr/police-sorgulama",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "X-KL-Ajax-Request": "Ajax_Request",
                "X-Requested-With": "XMLHttpRequest",
                "sec-ch-ua": `"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"`,
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": `"Windows"`,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Cookie": `ASP.NET_SessionId=${lastHeaderSessionId}; __RequestVerificationToken=${lastHeaderRequestVerificationToken}`,
            };

            const body = `identityNo=${identityNo}&cityCode=${cityCode}&districtCode=${districtCode}&queryType=2&gRecaptchaResponse=${gRecaptchaResponse}&__RequestVerificationToken=${formToken}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: body,
            });

            const responseStatus = response.status;
            const responseText = await response.text();
            const endTime = new Date().toLocaleTimeString('en-GB', { hour12: false });
            console.log(`${endTime} - Sorgu sonucu: ${responseText}`);

            let jsonResponse;
            try {
                jsonResponse = JSON.parse(responseText);  
            } catch (error) {
                jsonResponse = { message: "Yanıt JSON formatında değil", queryResult: responseText };
            }
            if (jsonResponse.queryResult === undefined) {
                console.log('API yanıtı beklenen formatta değil: ', responseText);
            }

            res.status(200).json({
                jsonResponse,
                queryResult: typeof jsonResponse.queryResult === 'string' ? jsonResponse.queryResult : JSON.stringify(jsonResponse.queryResult),
                startTime: startTime.toISOString(),
                captchaStartTime: captchaStartTime,
                captchaEndTime: captchaEndTime,
                endTime: endTime
            });

        } catch (error) {
            const endTime = new Date();
            res.status(500).json({
                message: `Bir hata oluştu: ${error.message}`,
                startTime: startTime,
                captchaStartTime: captchaStartTime,
                captchaEndTime: captchaEndTime,
                endTime: endTime
            });
        }
    } else {
        res.status(405).json({ message: 'Yalnızca POST istekleri kabul edilir' });
    }
}

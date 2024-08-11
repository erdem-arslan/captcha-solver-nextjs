"use client"
import Image from 'next/image';
import React, { useState, useEffect } from 'react';

export default function Home() {
    const [log, setLog] = useState([]);
    const [resultMessage, setResultMessage] = useState('');
    const [borderColor, setBorderColor] = useState('');

    useEffect(() => {
        if (log.length > 0) {
            const audio = new Audio('/notification.mp3');
            audio.play();
        }
    }, [log]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const data = {
            identityNo: formData.get('identityNo'),
            cityCode: formData.get('cityCode'),
            districtCode: formData.get('districtCode'),
        };

        setLog(prevLog => [...prevLog, `${new Date().toLocaleTimeString('en-GB', { hour12: false })} - İstek gönderildi`]);

        try {
            const response = await fetch('/api/police-sorgulama', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();
            const queryResult = result.jsonResponse.queryResult;

            setLog(prevLog => [
                ...prevLog,
                `${result.captchaStartTime} - Captcha çözüldü`,
            ]);

            if (queryResult === 1) {
                setResultMessage("Sorgulanan kişinin; sorgulanan il, ilçede poliçe kaydı bulunmaktadır");
                setBorderColor('text-green-600');
            } else if (queryResult === 0) {
                setResultMessage("Sorgulanan kişinin; sorgulanan il, ilçede poliçe kaydı bulunmamaktadır");
                setBorderColor('text-red-600');
            }

        } catch (error) {
            setLog(prevLog => [
                ...prevLog,
                `${new Date().toISOString()} - Hata: ${error.message}`,
            ]);
            setResultMessage("Bir hata oluştu. Lütfen tekrar deneyin.");
            setBorderColor('text-red-600');
        }
    };

    return (
        <div className='w-full h-screen flex items-center origin-center'>
            <div className='w-11/12 md:w-1/3 mx-auto bg-gray-200 p-4 rounded'>
                <div className='w-full font-semibold text-2xl flex items-center'>
                    <Image src='/dask-logo.png' width={70} height={70} quality={100} alt='logo' className='mr-4'/>
                    <p className='font-bold text-3xl '>Poliçe Sorgulama Paneli</p>
                </div>
                <div className=''>
                    <form className='flex flex-col my-10' onSubmit={handleSubmit}>
                        <div className='flex flex-col mb-4'>
                            <label className='text-black font-light' htmlFor="identityNo">TC Kimlik Numarası</label>
                            <input className='border border-black border-opacity-35 rounded px-4 py-3 font-normal bg-transparent text-black' type="text" name="identityNo" placeholder="TC Kimlik Numarası" required />
                        </div>
                        <div className='flex flex-col mb-4'>
                            <label className='text-black font-light' htmlFor="identityNo">İl</label>
                            <input className='border border-black border-opacity-35 rounded px-4 py-3 font-normal bg-transparent text-black' type="text" name="cityCode" placeholder="İl" required />
                        </div>
                        <div className='flex flex-col mb-4'>
                            <label className='text-black font-light' htmlFor="identityNo">İlçe</label>
                            <input className='border border-black border-opacity-35 rounded px-4 py-3 font-normal bg-transparent text-black' type="text" name="districtCode" placeholder="İlçe" required />
                        </div>

                        <button className='w-full py-2 bg-blue-600 text-white font-semibold rounded' type="submit">Sorgula</button>
                    </form>

                    <div id="log">
                        {log.map((entry, index) => (
                            <div className='mb-4 text-sm font-light ' key={index}>{entry}</div>
                        ))}
                    </div>

                    {resultMessage && (
                        <div className={`text-sm font-light ${borderColor} `}>
                            {resultMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

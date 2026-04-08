async function createPatient(payload) {
    if (typeof window.apiRequest === 'function') {
        return window.apiRequest(
            `${CONFIG.REDIS_API}/api/v1/patient`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            },
            'Redis API'
        );
    }

    const res = await fetch(`${CONFIG.REDIS_API}/api/v1/patient`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        let errorMessage = 'Request failed';
        try {
            const err = await res.json();
            errorMessage = err.detail || JSON.stringify(err);
        } catch {}
        throw new Error(errorMessage);
    }

    return res.json();
}

window.createPatient = createPatient;
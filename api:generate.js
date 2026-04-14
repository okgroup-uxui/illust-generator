export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt가 필요해요' });
  }

  // API Key는 Vercel 환경변수에서 가져옴 (사용자에게 노출 안 됨)
  const apiKey = process.env.SCENARIO_API_KEY;
  const MODEL_ID = 'model_CPxGWWCNz5TRs2cPbdQGoz2a';

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key가 설정되지 않았어요 (환경변수 확인 필요)' });
  }

  try {
    const inferenceRes = await fetch(
      `https://api.scenario.com/v1/models/${MODEL_ID}/inferences`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parameters: {
            prompt,
            numSamples: 1,
            width: 1024,
            height: 1024,
            numInferenceSteps: 40,
            guidance: 5,
            scheduler: 'EulerDiscreteScheduler',
          },
        }),
      }
    );

    if (!inferenceRes.ok) {
      const err = await inferenceRes.json();
      return res.status(inferenceRes.status).json({ error: err.message || 'Scenario API 오류' });
    }

    const inferenceData = await inferenceRes.json();
    const inferenceId = inferenceData.inference?.id;

    if (!inferenceId) {
      return res.status(500).json({ error: 'Inference ID를 받지 못했어요' });
    }

    // 결과 폴링
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const pollRes = await fetch(
        `https://api.scenario.com/v1/generate/inferences/${inferenceId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const pollData = await pollRes.json();
      const status = pollData.inference?.status;

      if (status === 'succeeded') {
        const imageUrl = pollData.inference?.images?.[0]?.url;
        if (!imageUrl) return res.status(500).json({ error: '이미지 URL을 받지 못했어요' });
        return res.status(200).json({ imageUrl });
      }

      if (status === 'failed') {
        return res.status(500).json({ error: '이미지 생성에 실패했어요' });
      }
    }

    return res.status(408).json({ error: '시간이 초과됐어요. 다시 시도해주세요.' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

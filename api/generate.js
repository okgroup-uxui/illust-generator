export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt가 필요해요' });
  }

  const keyId = process.env.SCENARIO_KEY_ID;
  const secret = process.env.SCENARIO_SECRET;
  const MODEL_ID = 'model_CPxGWWCNz5TRs2cPbdQGoz2a';

  if (!keyId || !secret) {
    return res.status(500).json({ error: 'API Key가 설정되지 않았어요 (SCENARIO_KEY_ID, SCENARIO_SECRET 확인 필요)' });
  }

  // Key ID:Secret 을 base64로 인코딩
  const credentials = Buffer.from(`${keyId}:${secret}`).toString('base64');

  try {
    const inferenceRes = await fetch(
      `https://api.scenario.com/v1/models/${MODEL_ID}/inferences`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
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

    const inferenceData = await inferenceRes.json();

    if (!inferenceRes.ok) {
      console.error('Scenario inference error:', JSON.stringify(inferenceData));
      return res.status(inferenceRes.status).json({
        error: inferenceData?.message || inferenceData?.error || 'Scenario API 오류',
        detail: inferenceData
      });
    }

    const inferenceId = inferenceData.inference?.id;

    if (!inferenceId) {
      console.error('No inference ID:', JSON.stringify(inferenceData));
      return res.status(500).json({ error: 'Inference ID를 받지 못했어요', detail: inferenceData });
    }

    // 결과 폴링 (최대 90초)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const pollRes = await fetch(
        `https://api.scenario.com/v1/generate/inferences/${inferenceId}`,
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const pollData = await pollRes.json();
      const status = pollData.inference?.status;

      console.log(`Polling attempt ${i + 1}, status: ${status}`);

      if (status === 'succeeded') {
        const imageUrl = pollData.inference?.images?.[0]?.url;
        if (!imageUrl) return res.status(500).json({ error: '이미지 URL을 받지 못했어요' });
        return res.status(200).json({ imageUrl });
      }

      if (status === 'failed') {
        return res.status(500).json({ error: '이미지 생성에 실패했어요', detail: pollData });
      }
    }

    return res.status(408).json({ error: '시간이 초과됐어요. 다시 시도해주세요.' });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

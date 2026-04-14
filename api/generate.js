export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, jobId } = req.body;

  const keyId = process.env.SCENARIO_KEY_ID;
  const secret = process.env.SCENARIO_SECRET;
  const MODEL_ID = 'model_CPxGWWCNz5TRs2cPbdQGoz2a';
  const BASE_MODEL = 'model_bfl-flux-1-dev';

  if (!keyId || !secret) {
    return res.status(500).json({ error: 'API Key가 설정되지 않았어요' });
  }

  const credentials = Buffer.from(`${keyId}:${secret}`).toString('base64');

  // Job ID로 상태 조회
  if (jobId) {
    try {
      const pollRes = await fetch(
        `https://api.cloud.scenario.com/v1/jobs/${jobId}?projectId=proj_gp2NkPp1GQsFKnFjHroTfJhm`
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const pollData = await pollRes.json();
      return res.status(200).json(pollData);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (!prompt) {
    return res.status(400).json({ error: 'prompt가 필요해요' });
  }

  // 이미지 생성 요청
  try {
    const inferenceRes = await fetch(
      `https://api.cloud.scenario.com/v1/generate/custom/${BASE_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: MODEL_ID,
          loras: [MODEL_ID],
          lorasScale: [0.8],
          prompt,
          strength: 0.8,
          numOutputs: 1,
          numInferenceSteps: 28,
          width: 1104,
          height: 832,
          guidance: 3.5,
        }),
      }
    );

    const data = await inferenceRes.json();

    if (!inferenceRes.ok) {
      return res.status(inferenceRes.status).json({
        error: data?.message || data?.error || 'Scenario API 오류',
        detail: data,
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

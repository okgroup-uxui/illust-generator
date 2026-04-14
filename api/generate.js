export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, jobId } = req.body;

  const keyId = process.env.SCENARIO_KEY_ID;
  const secret = process.env.SCENARIO_SECRET;
  const MODEL_ID = 'model_CPxGWWCNz5TRs2cPbdQGoz2a';
  const BASE_MODEL = 'model_bfl-flux-1-dev';
  const PROJECT_ID = 'proj_gp2NkPp1GQsFKnFjHroTfJhm';

  if (!keyId || !secret) {
    return res.status(500).json({ error: 'API Key가 설정되지 않았어요' });
  }

  const credentials = Buffer.from(`${keyId}:${secret}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
  };

  // Job ID로 상태 조회
  if (jobId) {
    try {
      const pollRes = await fetch(
        `https://api.cloud.scenario.com/v1/jobs/${jobId}?projectId=${PROJECT_ID}`,
        { headers }
      );

      const text = await pollRes.text();
      let pollData;
      try { pollData = JSON.parse(text); } catch(e) {
        return res.status(500).json({ error: '응답 파싱 오류: ' + text.substring(0, 200) });
      }

      const job = pollData?.job || pollData;
      const status = job?.status;
      const assetIds = job?.metadata?.assetIds || job?.assetIds || [];

      // 성공 + assetId 있으면 asset URL 조회
      if (status === 'success' && assetIds.length > 0) {
        const assetId = assetIds[0];
        const assetRes = await fetch(
          `https://api.cloud.scenario.com/v1/assets/${assetId}?projectId=${PROJECT_ID}`,
          { headers }
        );
        const assetData = await assetRes.json();
        const imageUrl = assetData?.asset?.url || assetData?.url;

        if (imageUrl) {
          return res.status(200).json({ status: 'success', imageUrl });
        }
      }

      return res.status(200).json({ status });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 프롬프트로 이미지 생성 요청
  if (!prompt) {
    return res.status(400).json({ error: 'prompt가 필요해요' });
  }

  try {
    const inferenceRes = await fetch(
      `https://api.cloud.scenario.com/v1/generate/custom/${BASE_MODEL}`,
      {
        method: 'POST',
        headers,
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

    const text = await inferenceRes.text();
    let data;
    try { data = JSON.parse(text); } catch(e) {
      return res.status(500).json({ error: '생성 요청 파싱 오류: ' + text.substring(0, 200) });
    }

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

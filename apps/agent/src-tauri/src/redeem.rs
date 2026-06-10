use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedeemResponse {
    pub token: String,
    pub livekit_url: String,
    pub room: String,
    pub presenter_identity: String,
    pub presenter_name: String,
}

pub async fn redeem_code(api_url: &str, code: &str) -> Result<RedeemResponse, String> {
    let url = format!("{}/control-agent/redeem", api_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&serde_json::json!({ "code": code }))
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("redeem failed ({status}): {body}"));
    }

    resp.json::<RedeemResponse>()
        .await
        .map_err(|e| format!("invalid response: {e}"))
}

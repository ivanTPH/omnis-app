const HUBSPOT_API = 'https://api.hubapi.com/crm/v3/objects/contacts'
const TOKEN = process.env.HUBSPOT_ACCESS_TOKEN

interface HubspotContactInput {
  email: string
  firstname?: string
  lastname?: string
  company?: string
  phone?: string
  message?: string
  leadSource: string
}

export async function upsertHubspotContact(input: HubspotContactInput): Promise<void> {
  if (!TOKEN) return // silently no-op when not configured

  const properties = {
    email: input.email,
    ...(input.firstname ? { firstname: input.firstname } : {}),
    ...(input.lastname  ? { lastname: input.lastname }   : {}),
    ...(input.company   ? { company: input.company }     : {}),
    ...(input.phone     ? { phone: input.phone }         : {}),
    omnis_lead_source:  input.leadSource,
    omnis_lead_message: input.message ?? '',
  }

  const createRes = await fetch(HUBSPOT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ properties }),
  })

  if (createRes.status === 409) {
    // Contact already exists — update by email
    await fetch(`${HUBSPOT_API}/${encodeURIComponent(input.email)}?idProperty=email`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ properties }),
    })
  }
}

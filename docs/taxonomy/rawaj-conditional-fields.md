# RAWAJ Conditional Fields Draft

Date: 2026-07-04

Status: corrected review artifact. Not implemented.

## Rule Shape

Near-machine-readable rule:

```json
{
  "field": "floor",
  "visible_when": { "property_type": ["apartment", "office", "clinic"] },
  "required_when": { "property_type": ["apartment"] },
  "hidden_when": { "property_type": ["land", "farm"] }
}
```

Rules should be evaluated after category/leaf selection and before validation.

## Control Variable Classification

| control key | classification | Notes |
| --- | --- | --- |
| `transaction_intent` | taxonomy context variable | Derived from selected leaf intent or explicit listing intent field where configured. |
| `property_type` | actual listing field or derived leaf context | Use actual field only where the leaf does not already imply type. |
| `property_group` | taxonomy context variable | Derived from selected real-estate branch, e.g. residential/commercial/land. |
| `vehicle_leaf` | taxonomy context variable | Derived from selected vehicle leaf, e.g. car/motorcycle/part. |
| `device_leaf` | taxonomy context variable | Derived from selected device leaf, e.g. phone/laptop/tv. |
| `salary_type` | actual listing field | Controls salary min/max fields. |
| `job_intent` | actual listing field or leaf context | Job offer vs job seeker. |
| `service_intent` | actual listing field or leaf context | Service offered vs requested. |
| `application_method` | actual listing field | Controls visibility of external application-link fields when the selected application method is external. |

## Real Estate Rules

```json
[
  {
    "field": "floor",
    "visible_when": { "property_type": ["apartment", "office", "clinic"] },
    "hidden_when": { "property_type": ["land", "farm", "warehouse"] }
  },
  {
    "field": "rooms",
    "visible_when": { "property_group": ["residential"] },
    "hidden_when": { "property_type": ["land", "warehouse", "shop"] }
  },
  {
    "field": "bathrooms",
    "visible_when": { "property_group": ["residential", "office", "shop"] },
    "hidden_when": { "property_type": ["land"] }
  },
  {
    "field": "rental_period",
    "visible_when": { "transaction_intent": ["rent", "short_rent"] },
    "hidden_when": { "transaction_intent": ["sale", "wanted_buy"] }
  },
  {
    "field": "deposit_amount",
    "visible_when": { "transaction_intent": ["rent"] },
    "required_when": {}
  },
  {
    "field": "available_from",
    "visible_when": { "transaction_intent": ["rent", "short_rent"] }
  },
  {
    "field": "furnished",
    "visible_when": { "property_group": ["residential"], "transaction_intent": ["rent", "short_rent", "sale"] }
  },
  {
    "field": "frontage_m",
    "visible_when": { "property_type": ["land", "shop"] }
  },
  {
    "field": "ceiling_height_m",
    "visible_when": { "property_type": ["warehouse", "workshop"] }
  },
  {
    "field": "truck_access",
    "visible_when": { "property_type": ["warehouse", "workshop"] }
  },
  {
    "field": "industrial_electricity",
    "visible_when": { "property_type": ["warehouse", "workshop", "industrial_land"] }
  }
]
```

Unresolved legal fields are intentionally absent until Syria-specific evidence is reviewed.

## Vehicle Rules

```json
[
  {
    "field": "body_type",
    "visible_when": { "vehicle_leaf": ["car", "suv", "pickup"] },
    "hidden_when": { "vehicle_leaf": ["motorcycle", "truck", "bus", "heavy_machinery", "part"] }
  },
  {
    "field": "engine_size",
    "visible_when": { "vehicle_leaf": ["car", "suv", "pickup", "motorcycle"] }
  },
  {
    "field": "payload_kg",
    "visible_when": { "vehicle_leaf": ["truck", "van"] }
  },
  {
    "field": "seats_count",
    "visible_when": { "vehicle_leaf": ["bus", "van"] }
  },
  {
    "field": "hours_used",
    "visible_when": { "vehicle_leaf": ["heavy_machinery", "agriculture_vehicle"] }
  },
  {
    "field": "mileage_km",
    "visible_when": { "vehicle_leaf": ["car", "suv", "pickup", "motorcycle", "truck", "bus", "van"] },
    "hidden_when": { "vehicle_leaf": ["part", "accessory"] }
  },
  {
    "field": "part_type",
    "visible_when": { "vehicle_leaf": ["part", "accessory"] }
  },
  {
    "field": "compatible_make",
    "visible_when": { "vehicle_leaf": ["part", "accessory"] }
  }
]
```

## Electronics Rules

```json
[
  {
    "field": "battery_health_percent",
    "visible_when": { "device_leaf": ["phone", "tablet", "laptop"] }
  },
  {
    "field": "sim_type",
    "visible_when": { "device_leaf": ["phone", "tablet"] }
  },
  {
    "field": "processor",
    "visible_when": { "device_leaf": ["laptop", "desktop", "component"] }
  },
  {
    "field": "gpu",
    "visible_when": { "device_leaf": ["laptop", "desktop", "component", "gaming"] }
  },
  {
    "field": "screen_size_in",
    "visible_when": { "device_leaf": ["tablet", "laptop", "tv", "monitor"] }
  },
  {
    "field": "smart_tv",
    "visible_when": { "device_leaf": ["tv"] }
  }
]
```

## Jobs and Services Rules

```json
[
  {
    "field": "salary_min",
    "visible_when": { "salary_type": ["fixed", "range"] }
  },
  {
    "field": "salary_max",
    "visible_when": { "salary_type": ["range"] }
  },
  {
    "field": "application_link",
    "visible_when": { "application_method": ["external"] }
  },
  {
    "field": "job_role",
    "visible_when": { "job_intent": ["job_offer"] },
    "hidden_when": { "job_intent": ["job_seeker"] }
  },
  {
    "field": "desired_role",
    "visible_when": { "job_intent": ["job_seeker"] },
    "hidden_when": { "job_intent": ["job_offer"] }
  },
  {
    "field": "starting_price",
    "visible_when": { "service_intent": ["service_offered"] }
  },
  {
    "field": "needed_date",
    "visible_when": { "service_intent": ["service_requested"] }
  }
]
```

## Guardrails

- A field hidden by `hidden_when` must not be validated as required.
- Do not show truck-only fields to motorcycles, car-only body fields to parts, or laptop-only specs to phones.
- Keep old `details` rendering compatible for legacy listings.

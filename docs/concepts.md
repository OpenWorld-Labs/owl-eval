# Owl-Eval System Overview

This document defines the core architecture, terminology, and data model for **Owl-Eval**, a platform for evaluating video outputs from generative models using human judgments. Participants are recruited through **Prolific**, while all evaluation logic, task content, and response handling are managed internally.

---

## Conceptual Overview

Owl-Eval is built around a small number of core entities:

| Entity              | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| **Organization**     | Top-level tenant. Owns studies, users, and assets.                          |
| **Study**            | Maps 1:1 to a Prolific Study. Defines participant pool and evaluation set.  |
| **Evaluation**       | An evaluation unit presented to participants. Either `PAIRWISE` or `SINGLE`.|
| **Video**            | Generated video asset. Used in Evaluations.                                |
| **Scenario**         | Logical grouping of Evaluations based on shared prompt/context.             |
| **Participant**      | A person completing tasks. Mapped to a Prolific user ID.                    |
| **SubmissionSession**| One participant’s complete session for a Study. Tracks Prolific status.     |
| **Response**         | A participant’s answer to one Evaluation.                                  |

---

## Evaluation Modes

Owl-Eval supports two evaluation modes per task:

- **PAIRWISE**: Compare two videos (video A vs video B), select preferred, and rate dimensions.
- **SINGLE**: Rate a single video on multiple dimensions.

Each `Evaluation` row stores `mode`, and references either:
- one video (`SINGLE`), or
- two videos (`PAIRWISE`: `video_a_id`, `video_b_id`).

---

## Data Model Summary

### Entity Relationships

```

Organization
└── Study
├── Scenario
├── Evaluation (mode: SINGLE or PAIRWISE)
│   └── uses Video(s)
├── SubmissionSession (per participant)
│   └── Response (per Evaluation)
└── Participant (via Prolific ID)

```

### Key Tables

- `Study`: `id`, `org_id`, `title`, `reward`, `external_study_url`
- `Evaluation`: `id`, `study_id`, `mode`, `video_a_id`, `video_b_id`, `scenario_id`
- `Video`: `id`, `study_id`, `uri`, `model_tag`, `metadata`
- `Scenario`: `id`, `study_id`, `label`, `prompt_text`
- `Participant`: `id`, `prolific_id`
- `SubmissionSession`: `id`, `study_id`, `participant_id`, `status`, `started_at`, `completed_at`
- `Response`: `id`, `evaluation_id`, `session_id`, `choice`, `ratings_json`, `timestamp`

---

## Prolific Integration

- Owl-Eval maps **one internal Study** to **one Prolific Study**.
- All task structure (scenarios, evaluations, videos) is hosted on Owl-Eval servers.
- Participants are routed via `external_study_url` to your evaluation UI.
- Upon completion:
  - Owl-Eval provides the **Prolific completion code**.
  - `SubmissionSession` is recorded and linked to `Responses`.
- Bonuses and messages can be issued via Prolific API using `submission_id`.

> Prolific does **not** track tasks, scenarios, or evaluations. These are internal-only.

---

## Task Execution Flow

1. **Study** created in Owl-Eval, then pushed to Prolific via API.
2. Participants access Owl-Eval via `external_study_url`.
3. Each participant is assigned Evaluations (stratified/random).
4. Participant completes tasks → Responses saved.
5. Upon completion, Prolific completion code shown and session closed.
6. Researchers may manually or programmatically:
   - Approve/reject sessions.
   - Issue bonuses.
   - Analyze results per model, scenario, or participant.

---

## Extensibility Guidelines

- To support **multi-org tenants**: enforce `org_id` on all root-level resources.
- To support **ranking tasks**: generalize `Evaluation` to allow >2 video references.
- To support **A/B testing or dynamic prompts**: expand `Scenario` metadata.
- To support **longitudinal studies**: allow multiple `SubmissionSession`s per Participant.

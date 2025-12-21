# Intelligence Hub: Forensic Discovery Roadmap

## Phase 1: Signal Interception (Current)
- **Engine**: Gemini 3 Flash with Google Search Grounding.
- **Input**: Natural language "manifestos" describing the ideal sponsor profile.
- **Output**: 5 High-fidelity business entities with verified:
    - Emails (Owner/Admin level)
    - Phone numbers (Direct business lines)
    - Social Identifiers (IG, LinkedIn, X)
    - Match Reasoning (Strict 1-sentence limit)

## Phase 2: CRM Integration (Active)
- **Mechanism**: "Incorporate Prospect" button.
- **Data Mapping**:
    - `companyName` -> `Sponsor.companyName`
    - `website` -> `Sponsor.website`
    - `email` -> `Sponsor.email`
    - `socialLinks` -> `Sponsor.socialLinks` (Mapped by platform key)
    - `matchReasoning` -> `Deal.notes`

## Phase 3: Outreach Hub & Sequences (In Progress)
- **Logic**: Platform-aware drafting.
- **Email Protocol**: `mailto:` pre-fill with AI proposal shard.
- **Social Protocol**: Profile deep-linking + clipboard staging.
- **Automation**: One-click logging to the forensic activity timeline.

## Phase 4: Follow-up & Lifecycle (Next)
- **Feature**: Next-action date triggers.
- **Dashboard**: "Critical Intercepts" section powered by maturity dates.
- **Outcome**: 0% lead decay.
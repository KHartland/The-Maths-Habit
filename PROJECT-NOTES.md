# Square One Maths - Project Notes

**Last Updated:** February 2026

## Project Overview

**Square One Maths** is a GCSE Maths practice app built with React. It provides exam-style questions for students aged 14-16, covering Foundation and Higher tier content aligned with AQA specification.

---

## Question Structure

### Question Banks in `src/App.jsx`

The app contains **four question banks**:

1. **`questionBank`** - Foundation tier practice questions (by topic)
2. **`higherQuestionBank`** - Higher tier practice questions (by topic)
3. **`examQuestions`** - Foundation tier exam-style questions (starts ~line 2714)
4. **`higherExamQuestions`** - Higher tier exam-style questions

### Question Format

```javascript
{
  q: "Question text here",
  a: "Answer",
  type: "number" | "text" | "fraction" | "multiple",
  calculator: true | false,
  marks: 1-5
}
```

### Spec Codes

Questions are organised by AQA specification codes:
- **N** = Number (N1-N16)
- **A** = Algebra (A1-A26)
- **R** = Ratio & Proportion (R1-R14)
- **G** = Geometry (G1-G20)
- **P** = Probability (P1-P8)
- **S** = Statistics (S1-S5)

---

## Image Generation Work

### Purpose
Create supporting images for exam questions using **Higgsfield AI** image generator.

### Style Guide
- **Target audience:** 14-16 year olds (GCSE students)
- **Aesthetic:** Modern, sophisticated, professional
- **Avoid:** Cartoonish, childish, overly cute illustrations
- **Aim for:** Editorial photography, clean infographics, technical diagrams

### Key Files

| File | Purpose |
|------|---------|
| `/public/higgsfield-prompts-v4.txt` | **CURRENT** - Final corrected prompts |
| `/public/higgsfield-prompts-v3.txt` | Previous version (has issues) |
| `/public/image-style-guide.md` | Unified visual style guide |

### Core Aesthetic: Metallic Blue
The app uses a **polished metallic blue gradient** as its signature look throughout the UI and diagrams.

**Gradient values:**
- Highlight: `#8BA8D9`
- Base: `#5B7FC7`
- Shadow: `#3D5A8A`

**Supporting colours:**
- **Orange (#F59E0B)** - Given measurements and values
- **Gold (#D4A84B)** - Angle markers, highlights
- **Dark Grey (#374151)** - Text, outlines

### Critical Principle
**Images must NOT reveal answers.** Only show GIVEN information from questions. Students must calculate derived values themselves.

---

## Issues Fixed (V3 → V4)

### 1. N1 Juice Bottles
- **Problem:** Prompt showed total prices (£1.50, £2.50, etc.) but question gives prices PER LITRE
- **Fix:** Removed prices from bottles entirely

### 2. N2 Submarine Depth
- **Problem:** Showed -27m, -45m, -81m markers revealing calculated depths
- **Fix:** Shows only depth scale (0 to -100m) with no trajectory labels

### 3. N6 Square Garden
- **Problem:** Question was logically flawed (fence post counting with corner ambiguity)
- **Also:** Prompt showed "12m" which reveals √144
- **Fix:**
  - Replaced question: "A square garden has area 144 m². What is the perimeter of the garden?" (Answer: 48)
  - Prompt shows only "Area = 144 m²" - no side length

### 4. N7 Storage Cubes
- **Problem:** Prompt showed "5m" for large cube, revealing ∛125
- **Fix:** Shows "Volume = 125 m³" only - student calculates side length

---

## Image Types

Three categories defined in style guide:

1. **Context Images** - Realistic photography providing real-world context
2. **Diagram Images** - Clean technical illustrations with measurements
3. **Hybrid Images** - Photography with geometric/measurement overlays

---

## Version History

| Version | Changes |
|---------|---------|
| V1 | Initial prompts - too colourful/childish |
| V2 | More mature style - but revealed answers |
| V3 | Removed answer-revealing content - still had issues |
| V4 | **CURRENT** - Fixed N1, N2, N6, N7 issues |

---

## Future Considerations

### When Adding New Questions
1. Ensure prompt shows only GIVEN information
2. Never show calculated/derived values in images
3. Check that question logic is sound (especially counting problems)
4. Match image style to target age group (mature, not childish)

### Prompt Review Checklist
- [ ] Does the image show any ANSWERS?
- [ ] Does the image show values the student must CALCULATE?
- [ ] Does the question data match the prompt data?
- [ ] Is the style age-appropriate (14-16)?

---

## Technical Notes

- React app with standard create-react-app structure
- Questions stored as JavaScript objects in App.jsx
- Image prompts are plain text files for copy/paste into Higgsfield
- 52 total image prompts across Foundation and Higher tiers

---

## File Locations

```
/src/App.jsx              - Main app with all question banks
/public/
  ├── higgsfield-prompts-v4.txt   - Current image prompts
  ├── higgsfield-prompts-v3.txt   - Previous version
  ├── image-style-guide.md        - Visual style documentation
  └── question-review.html        - Question review tool
```

---

## Contact/Continuation Notes

If continuing this work in a new session:
1. Read this PROJECT-NOTES.md first
2. Check `/public/higgsfield-prompts-v4.txt` for current prompts
3. Questions are in `src/App.jsx` - search for `examQuestions` (~line 2714)
4. Style guide is in `/public/image-style-guide.md`

---

## Session Log

### 27 January 2026
**Focus:** Image prompts for exam questions

**Work completed:**
- Created image prompts for all 52 exam questions (Foundation + Higher)
- Iterated through 4 versions (V1→V4) refining style and accuracy
- Established mature, sophisticated visual style suitable for 14-16 year olds
- Fixed N6 question in App.jsx (replaced flawed fence post question with perimeter question)

**Key decisions:**
- Images should NOT reveal answers - only show given information
- Style: editorial photography, clean infographics, technical diagrams
- Avoid childish/cartoonish imagery

**Issues resolved:**
- N1: Removed mismatched prices from bottle image
- N2: Simplified submarine to just depth scale (no trajectory labels)
- N6: New question + prompt showing only "Area = 144 m²"
- N7: Prompt shows "Volume = 125 m³" only (not side length)

**Current state:**
- `higgsfield-prompts-v4.txt` is the active prompts file
- Ready to generate images in Higgsfield AI

---

### 7 February 2026
**Focus:** UI overhaul + 1v1 Battle Mode

**Work completed:**

**UI Changes:**
- Switched from dark purple theme to **metallic blue gradient** (light theme)
- Updated all CSS in `index.css` and `tailwind.config.js`
- Fixed calculator - number buttons were invisible on light theme
- Removed "How confident are you?" selection
- Removed exam tips (didn't match questions)
- Updated N7 question volume from 125m³ to 64m³ (answer: 8 cubes)
- Updated A15 question to calculable turning point question

**1v1 Battle Mode (NEW FEATURE):**
- Created `src/components/OneVsOne.jsx` - full multiplayer UI
- Created `src/lib/matchService.js` - Supabase real-time match logic
- Created `supabase/migrations/001_create_matches_table.sql` - database schema
- Added "1v1 Battle" button on home page

**1v1 Game Rules:**
- Winner = highest score (time only for tiebreaker)
- Create match → get 6-digit code to share
- Both players get same random questions
- Real-time score tracking via Supabase
- Uses existing `answersEquivalent` function for smart answer checking

**Setup Required:**
1. Run SQL migration in Supabase dashboard
2. Enable Realtime for `matches` table

**Files changed:**
- `src/index.css` - New metallic blue theme
- `tailwind.config.js` - Updated colour palette
- `src/App.jsx` - Calculator fix, removed confidence/tips, added 1v1
- `src/components/OneVsOne.jsx` - NEW
- `src/lib/matchService.js` - NEW
- `supabase/migrations/001_create_matches_table.sql` - NEW

---

### 7 February 2026 (continued)
**Focus:** Handwriting Input (Arc Maths style)

**Work completed:**

**Handwriting Input Feature:**
- Created `src/components/HandwritingInput.jsx` - Canvas-based handwriting component
- Uses Mathpix Digital Ink API for real-time recognition (industry standard for math OCR)
- Added "Write" mode toggle alongside Type and Photo modes
- Smooth flow: write → recognize → verify/edit → submit

**Technical Implementation:**
- Canvas captures mouse/touch strokes with timestamps
- Debounced API calls (500ms after last stroke)
- Converts stroke data to Mathpix format (x, y, t arrays)
- LaTeX simplification: fractions, roots, powers converted to readable format
- Works without API keys (shows stroke count as fallback)

**User Flow:**
1. User selects ✏️ Write mode
2. Draws answer on canvas (with undo/clear)
3. Recognition displays in real-time
4. Click "Use Answer" → switches to Type mode with recognized text
5. User can verify/edit before submitting

**Setup Required:**
- Add Mathpix API keys to `.env`:
  ```
  VITE_MATHPIX_APP_ID=your_app_id
  VITE_MATHPIX_APP_KEY=your_app_key
  ```
- Get keys from https://accounts.mathpix.com/

**Files changed:**
- `src/components/HandwritingInput.jsx` - NEW
- `src/App.jsx` - Added import, handwriting toggle, integration

---

*To add to this log, say "Update PROJECT-NOTES.md with what we did today"*

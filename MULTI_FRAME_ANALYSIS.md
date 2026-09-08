# ARGUS V6 Multi-Frame Analysis

This build changes the analysis payload from one flat `nodes` array to a nested multi-frame structure.

## Manual analysis behavior
- One selected frame: analyzes that frame.
- Multiple selected frames: analyzes every selected frame independently and combines the results.
- Nothing selected: analyzes all top-level frames on the current Figma page.

## Near-real-time behavior
Near-real-time scanning requires an explicit selection. Selected layers are resolved to their containing frame so the frame remains the analysis boundary. Multiple selected frames are supported.

## Metadata structure
```json
{
  "frameCount": 3,
  "nodeCount": 36,
  "frames": [
    {
      "frameId": "2:47",
      "frameName": "Add Recipes",
      "frameType": "FRAME",
      "nodeCount": 12,
      "nodes": []
    }
  ]
}
```

The backend analyzes each `frames[i].nodes` collection separately before combining candidates for model classification and recommendations.

## Existing Supabase database
Run `argus_backend/supabase/multi_frame_migration.sql` once in the Supabase SQL Editor.

## Backward compatibility
The backend still accepts older flat payloads containing a top-level `nodes` array.

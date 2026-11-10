# GUCA Atlas

`index.html` is the Organism Atlas for the GUCA website. The page loads the overview first. It requests observations when the user opens the history, source records when the user selects one, and exports when the user clicks a download link.

Run `npm start` from the GUCA site repository and open `http://127.0.0.1:8080/atlas/`. For offline use, open `quadmesh-organism-atlas-isl1-post-pl3-v1.html` in the research workspace.

All nine experiments are selected at first load. Organism is open. The other sidebar sections are closed. About contains the map guide and research methods. Downloads is the last sidebar section.

The data comes from `esd9-isl1-post-pl3-v1`. The score contract is `atlas-quadmesh-canonical-v1`. The export receipt records the payload hash and form counts.

The editable interface and streaming builder are in the GUCA research workspace at `research-assets/organisms-and-forms/quadmesh-organism-atlas/interface/`.

From that workspace, rebuild the standalone page, then export the site page:

```bash
python3 -B research-assets/organisms-and-forms/quadmesh-organism-atlas/interface/build.py
python3 -B research-assets/organisms-and-forms/quadmesh-organism-atlas/interface/build.py --site --output guca/atlas/index.html
```

Serve the generated `index.html` with its `payload-*` directory. The builder checks each exported record against the offline source and records the initial page size in `package-receipt.json`.

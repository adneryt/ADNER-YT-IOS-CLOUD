window.addEventListener("load", () => {
  "use strict";

  const api = window.ADNERAdminAPI;
  const target = document.getElementById("package-admin");

  if (!api || !target) {
    console.error("ADNER V4.2: administrador no disponible");
    return;
  }

  if (document.getElementById("adner-v42")) return;

  const panel = document.createElement("section");
  panel.id = "adner-v42";
  panel.className = "panel";

  panel.innerHTML = `
    <h3>ADNER IOS V4.2 · Control de paquetes</h3>
    <p class="muted">
      Control de hologramas, avatar, fileinfo y shaders.
      Publicado no significa instalado en el iPhone.
    </p>
    <label class="block-label">
      Seleccionar juego
      <select id="v42-game">
        <option value="all">Todos</option>
        <option value="com.dts.freefiremax">FF MAX</option>
        <option value="com.dts.freefireth">FF NORMAL</option>
      </select>
    </label>
    <p id="v42-count" class="hint"></p>
    <div id="v42-list"></div>
  `;

  target.insertAdjacentElement("afterend", panel);

  const render = () => {
    const records = (api.state.items || []).filter(x => x.package);
    const game = document.getElementById("v42-game").value;
    const list = document.getElementById("v42-list");

    let published = [];

    try {
      const current = api.state.published;
      const manifest = typeof current?.payload === "string"
        ? JSON.parse(current.payload)
        : current;
      published = Array.isArray(manifest?.items)
        ? manifest.items
        : [];
    } catch (_) {}

    list.replaceChildren();

    const filtered = records.filter(x =>
      game === "all" || x.package.game === game
    );

    let online = 0;

    for (const record of filtered) {
      const p = record.package;
      const files = Array.isArray(p.files) ? p.files : [];
      const fileinfo = files.find(f => f.role === "fileinfo");
      const shaders = files.filter(f => f.role === "shader");

      const live = published.find(x =>
        x.id === record.id && x.package
      );

      const isCurrent = Boolean(live) &&
        JSON.stringify(live.package) === JSON.stringify(p);

      if (isCurrent) online++;

      let validation = "Correcta";

      try {
        window.ADNERPackages.validate(p, true);
      } catch (e) {
        validation = "Revisar: " + e.message;
      }

      const box = document.createElement("article");
      box.className = "panel";
      box.style.marginTop = "12px";

      const title = document.createElement("h3");
      title.textContent = p.name || record.name || record.id;

      const details = document.createElement("p");
      details.className = "muted";
      details.style.whiteSpace = "pre-line";

      details.textContent = [
        "Juego: " + p.game,
        "Tipo: " + p.kind,
        "Estado: " + (isCurrent ? "PUBLICADO" :
          live ? "CAMBIOS SIN PUBLICAR" : "NO PUBLICADO"),
        "Archivos: " + files.length,
        "Fileinfo: " + (fileinfo?.target || "No declarado"),
        "Referencia de respaldo: " +
          (fileinfo?.baseline ? "Incluida" : "No incluida"),
        "Shaders adicionales: " + shaders.length,
        "Shader original protegido: " +
          (p.protectedShader || "No declarado"),
        "Validacion: " + validation,
        "Instalacion en iPhone: SIN VERIFICAR"
      ].join("\n");

      box.append(title, details);
      list.appendChild(box);
    }

    document.getElementById("v42-count").textContent =
      `Paquetes: ${filtered.length} | Publicados: ${online} | Pendientes: ${filtered.length - online}`;

    if (!filtered.length) {
      list.textContent = "No hay paquetes para este juego.";
    }
  };

  document.getElementById("v42-game").addEventListener("change", render);

  const catalog = document.getElementById("catalog-list");

  if (catalog) {
    new MutationObserver(render).observe(catalog, {
      childList: true
    });
  }

  render();
});
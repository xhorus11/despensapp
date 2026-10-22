/* despensAPP · Exportadores: Informe PDF, CSV para Excel e imágenes PNG */
const Exporter = (() => {
  const PURPLE = [20, 12, 51], ACCENT = [139, 92, 246], PINK = [236, 72, 153];
  const clean = s => String(s ?? '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
  const money = n => Money.fmt(n).replace(/ /g, ' ');

  function imgSize(dataUrl) {
    return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = dataUrl; });
  }

  async function pdf(range) {
    if (!window.jspdf) { UI.toast('Librería PDF no disponible', { type: 'err' }); return; }
    UI.toast('Generando informe…', { icon: 'file' });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const h = Store.state.household;
    const list = Money.inRange(range).slice().sort((a, b) => a.date.localeCompare(b.date));
    const real = list.filter(e => e.cat !== 'Ajuste');
    const total = real.reduce((s, e) => s + (+e.amount || 0), 0);

    // Portada / encabezado
    doc.setFillColor(...PURPLE); doc.rect(0, 0, W, 38, 'F');
    doc.setFillColor(...ACCENT); doc.rect(0, 38, W, 1.6, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text('Informe de Gastos del Hogar', 14, 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(`${clean(h.name)}  ·  ${range.label}`, 14, 26);
    doc.setFontSize(8.5); doc.setTextColor(200, 190, 255);
    doc.text(`Generado el ${new Date().toLocaleString('es-CL')} con despensAPP`, 14, 32);

    let y = 48;
    doc.setTextColor(30); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Resumen', 14, y); y += 2;
    const sum = [['Total gastado', money(total)], ['N° de gastos', String(real.length)]];
    if (h.budget && range.label) sum.push(['Presupuesto meta (' + (h.period === 'semana' ? 'semanal' : 'mensual') + ')', money(h.budget)], ['Diferencia', money(h.budget - total)]);
    doc.autoTable({ startY: y + 2, body: sum, theme: 'plain', styles: { fontSize: 10, cellPadding: 1.6 }, columnStyles: { 0: { textColor: 90 }, 1: { fontStyle: 'bold', halign: 'right' } }, margin: { left: 14, right: W / 2 } });

    const cats = Money.byCat(list);
    doc.autoTable({
      startY: 50, head: [['Categoría', 'Monto', '%']], body: cats.map(([c, v]) => [c, money(v), total ? Math.round(v / total * 100) + '%' : '']),
      theme: 'grid', headStyles: { fillColor: ACCENT }, styles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }, margin: { left: W / 2 + 4, right: 14 },
    });
    y = Math.max(doc.lastAutoTable.finalY, 80) + 8;

    // Cuentas claras
    const mem = h.members;
    if (mem.length > 1) {
      const bal = Money.balances(list);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Cuentas claras del período', 14, y);
      doc.autoTable({
        startY: y + 3, head: [['Integrante', 'Pagó', 'Le corresponde', 'Saldo']],
        body: bal.map(b => [b.member, money(b.paid), money(b.share), (b.net > 0 ? '+' : '') + money(b.net)]),
        theme: 'striped', headStyles: { fillColor: PURPLE }, styles: { fontSize: 9.5 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      });
      y = doc.lastAutoTable.finalY + 4;
      const st = Money.settle(bal);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      (st.length ? st.map(s => `•  ${s.from} debe transferir ${money(s.amount)} a ${s.to}`) : ['•  Están a mano en este período.']).forEach(t => { doc.text(t, 16, y + 4); y += 5.5; });
      y += 4;
    }

    // Detalle
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Detalle de gastos', 14, y);
    doc.autoTable({
      startY: y + 3,
      head: [['Fecha', 'Descripción', 'Categoría', 'Pagó', 'Método', 'Documento', 'Monto']],
      body: list.map(e => [UI.fmtDate(e.date, { day: '2-digit', month: '2-digit', year: '2-digit' }), clean(e.desc || '-') + (e.notes ? '\n' + clean(e.notes) : ''), e.cat, e.payer || '-', e.method || '-', `${e.docType || ''}${e.docNum ? ' ' + e.docNum : ''}`, money(e.amount)]),
      foot: [['', '', '', '', '', 'Total', money(total)]],
      theme: 'striped', headStyles: { fillColor: PURPLE }, footStyles: { fillColor: [240, 236, 255], textColor: 20, fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 1.8 }, columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Desglose de ítems
    const withItems = list.filter(e => (e.items || []).length);
    withItems.forEach(e => {
      if (y > H - 40) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
      doc.text(`Desglose: ${clean(e.desc || e.cat)} (${UI.fmtDate(e.date, { day: '2-digit', month: '2-digit' })})`, 14, y);
      doc.autoTable({
        startY: y + 2, head: [['Producto', 'Cantidad', 'Precio']],
        body: e.items.map(x => [clean(x.n), Units.fmt(x.q, x.u), x.price ? money(x.price) : '-']),
        theme: 'grid', headStyles: { fillColor: ACCENT }, styles: { fontSize: 8 }, columnStyles: { 2: { halign: 'right' } },
      });
      y = doc.lastAutoTable.finalY + 8;
    });

    // Firmas
    if (y > H - 50) { doc.addPage(); y = 24; }
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Conformidad', 14, y); y += 22;
    const signers = mem.length ? mem : ['Responsable'];
    const colW = (W - 28) / Math.min(3, signers.length);
    signers.forEach((m, k) => {
      const col = k % 3; if (col === 0 && k) y += 26;
      const x = 14 + col * colW;
      doc.setDrawColor(120); doc.line(x + 4, y, x + colW - 6, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(m, x + colW / 2 - 1, y + 5, { align: 'center' });
    });

    // Anexo de boletas
    const photos = list.flatMap(e => (e.photos || []).map(id => ({ id, e })));
    if (photos.length) {
      for (const p of photos) {
        let blob = await Photos.get(p.id);
        if (!blob && typeof Sync !== 'undefined') blob = await Sync.fetchPhoto(p.id);
        if (!blob) continue;
        const data = await Photos.toDataURL(blob);
        const sz = await imgSize(data);
        if (!sz) continue;
        doc.addPage();
        doc.setFillColor(...PURPLE); doc.rect(0, 0, W, 16, 'F');
        doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(`Anexo · ${clean(p.e.desc || p.e.cat)} · ${UI.fmtDate(p.e.date, { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${money(p.e.amount)}`, 14, 10.5);
        const maxW = W - 28, maxH = H - 34;
        const sc = Math.min(maxW / sz.w, maxH / sz.h);
        doc.addImage(data, 'JPEG', (W - sz.w * sc) / 2, 22, sz.w * sc, sz.h * sc);
      }
    }

    // Numeración
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`${clean(h.name)} · despensAPP · página ${i} de ${n}`, W / 2, H - 6, { align: 'center' });
    }
    const name = `informe-gastos-${Catalog.slug(h.name)}-${Catalog.slug(range.label)}.pdf`;
    const blob = doc.output('blob');
    await shareOrDownload(blob, name, 'application/pdf');
    Store.log('money', `exportó el informe PDF de ${range.label}`); Store.commit();
  }

  function csv(range) {
    const list = Money.inRange(range).slice().sort((a, b) => a.date.localeCompare(b.date));
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Fecha', 'Descripción', 'Categoría', 'Monto', 'Pagó', 'Repartido entre', 'Método', 'Documento', 'N° documento', 'Notas', 'Ítems']];
    list.forEach(e => rows.push([e.date, e.desc, e.cat, Math.round(+e.amount || 0), e.payer, (e.among || []).join(', '), e.method, e.docType, e.docNum, e.notes, (e.items || []).map(x => `${x.n} (${Units.fmt(x.q, x.u)}${x.price ? ' ' + x.price : ''})`).join(' | ')]));
    const txt = '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n');
    shareOrDownload(new Blob([txt], { type: 'text/csv;charset=utf-8' }), `gastos-${Catalog.slug(range.label)}.csv`, 'text/csv');
  }

  async function shareOrDownload(blob, name, type) {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    UI.download(blob, name);
    UI.toast(`Descargado: ${esc(name)}`, { icon: 'download' });
  }

  async function nodePng(node, name) {
    if (!node || !window.html2canvas) { UI.toast('No disponible', { type: 'err' }); return; }
    const canvas = await html2canvas(node, { backgroundColor: '#140c33', scale: 2, useCORS: true });
    canvas.toBlob(b => shareOrDownload(b, name, 'image/png'), 'image/png');
  }

  async function textPng(text, name) {
    const box = document.createElement('div');
    box.className = 'png-card';
    box.innerHTML = `<div class="png-brand">despensAPP</div><pre>${esc(text)}</pre>`;
    document.body.appendChild(box);
    try { await nodePng(box, name); } finally { box.remove(); }
  }

  return { pdf, csv, nodePng, textPng };
})();

// Interface do painel. Toda informação exibida vem da API; nada é inventado no navegador.
const $ = (selector) => document.querySelector(selector);

const VIEWS = {
    overview: "Visão geral",
    criar: "Criar pagamento",
    pagamentos: "Pagamentos",
    monitor: "Monitor de webhook",
    sistema: "Status do sistema"
};
const LABEL = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado", cancelled: "Cancelado" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const state = {
    payments: [],      // todos os pagamentos (visão geral e monitor)
    list: [],          // pagamentos da tela "Pagamentos", já filtrados pela API
    events: [],        // eventos processados (MySQL)
    system: null,      // resposta de GET /status; null = API sem resposta
    filter: "",
    log: [],           // respostas às simulações desta sessão
    lastEvent: null,   // último evento enviado, para demonstrar duplicidade
    error: null
};

/* ---------- Utilitários ---------- */

// Cria um elemento. O texto sempre entra como nó de texto (sem innerHTML).
function h(tag, props = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (key === "class") element.className = value;
        else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
        else element.setAttribute(key, value);
    }
    element.append(...children.filter((child) => child !== null && child !== undefined));
    return element;
}

const formatDate = (value) => (value ? new Date(value).toLocaleString("pt-BR") : "—");
const shortId = (id) => id.slice(0, 8).toUpperCase();
const statusTag = (status) => h("span", { class: `st st-${status}` }, h("i"), LABEL[status] || status);
const empty = (title, text, error) => h("div", { class: `empty${error ? " error" : ""}` }, h("b", {}, title), text);

// Devolve { ok, status, data } sem lançar erro para respostas HTTP de falha.
async function request(url, options) {
    let response;
    try {
        response = await fetch(url, options);
    } catch {
        return { ok: false, status: 0, data: { erro: "Não foi possível conectar ao servidor." } };
    }
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
}

async function api(url, options) {
    const { ok, status, data } = await request(url, options);
    if (!ok) throw new Error(data.erro || `Erro ${status}`);
    return data;
}

const postJson = (body, headers = {}) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
});

function toast(text, error = false) {
    const element = h("div", { class: `toast${error ? " error" : ""}` }, text);
    $("#toasts").append(element);
    setTimeout(() => element.remove(), 4500);
}

async function withLoading(button, action) {
    button.disabled = true;
    button.classList.add("loading");
    try {
        await action();
    } finally {
        button.disabled = false;
        button.classList.remove("loading");
    }
}

function table(headers, rows) {
    return h("div", { class: "scroll" },
        h("table", {},
            h("thead", {}, h("tr", {}, ...headers.map((header) =>
                h("th", header.startsWith("#") ? { class: "num" } : {}, header.replace("#", ""))))),
            h("tbody", {}, ...rows.map((cells) => h("tr", {}, ...cells.map((cell, index) =>
                h("td", headers[index].startsWith("#") ? { class: "num" } : {}, cell)))))
        ));
}

const idCell = (id) => h("span", { class: "mono", title: id }, shortId(id));
const clientName = (id) => state.payments.find((payment) => payment.id === id)?.cliente ?? "—";

function details(payment) {
    const rows = [
        ["Identificador", h("span", { class: "mono" }, payment.id)],
        ["Cliente", payment.cliente],
        ["Valor", money.format(payment.valor)],
        ["Status", statusTag(payment.status)],
        ["Criado em", formatDate(payment.criadoEm)],
        ["Atualizado em", formatDate(payment.atualizadoEm)]
    ];
    return h("dl", { class: "details" }, ...rows.flatMap(([term, value]) => [h("dt", {}, term), h("dd", {}, value)]));
}

/* ---------- Carga de dados ---------- */

async function loadSystem() {
    const { ok, data } = await request("/status");
    state.system = ok ? data : null;
    renderSystem();
}

async function loadData() {
    try {
        const [payments, events] = await Promise.all([api("/pagamentos"), api("/webhook/eventos")]);
        state.payments = payments.pagamentos;
        state.events = events.eventos;
        state.error = null;
    } catch (error) {
        state.error = error.message;
    }
    renderOverview();
    renderMonitor();
}

async function loadList() {
    const container = $("#list");
    try {
        const query = state.filter ? `?status=${state.filter}` : "";
        state.list = (await api(`/pagamentos${query}`)).pagamentos;
        renderList();
    } catch (error) {
        $("#list-meta").textContent = "";
        container.replaceChildren(empty("Falha ao carregar", error.message, true));
    }
}

const refreshAll = () => Promise.all([loadData(), loadList(), loadSystem()]);

/* ---------- Visão geral ---------- */

function renderOverview() {
    const payments = state.payments;
    const failed = state.error !== null;
    const byStatus = (status) => payments.filter((payment) => payment.status === status);
    const sum = (items) => money.format(items.reduce((total, payment) => total + payment.valor, 0));
    const value = (text) => (failed ? "—" : text);
    const card = (label, text, color, note) => h("div", { class: "stat", style: `--c:${color}` },
        h("span", {}, label), h("b", {}, value(text)), note ? h("small", {}, note) : null);

    $("#stats").replaceChildren(
        card("Total", payments.length, "var(--orange)"),
        ...Object.keys(LABEL).map((status) => card(`${LABEL[status]}s`, byStatus(status).length, `var(--${status})`))
    );
    $("#finance").replaceChildren(
        card("Valor total", sum(payments), "var(--orange)", "Soma de todas as cobranças simuladas"),
        card("Valor aprovado", sum(byStatus("approved")), "var(--approved)"),
        card("Valor pendente", sum(byStatus("pending")), "var(--pending)")
    );

    const fill = (selector, items, headers, toRow, emptyText) => {
        const node = failed ? empty("Dados indisponíveis", state.error, true)
            : items.length ? table(headers, items.map(toRow))
            : empty("Sem registros", emptyText);
        $(selector).replaceChildren(node);
    };
    fill("#recent-created", payments.slice(0, 5), ["Cliente", "#Valor", "Status", "Criado em"],
        (p) => [p.cliente, money.format(p.valor), statusTag(p.status), formatDate(p.criadoEm)],
        "Nenhum pagamento criado ainda.");
    const updated = payments.filter((p) => p.atualizadoEm)
        .sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm)).slice(0, 5);
    fill("#recent-updated", updated, ["Cliente", "Status atual", "Atualizado em"],
        (p) => [p.cliente, statusTag(p.status), formatDate(p.atualizadoEm)],
        "Nenhum pagamento teve o status alterado.");
    fill("#recent-events", state.events.slice(0, 5), ["Evento", "Pagamento", "Novo status", "Recebido em"],
        (e) => [h("span", { class: "mono" }, e.eventoId), idCell(e.pagamentoId), statusTag(e.status), formatDate(e.recebidoEm)],
        "Nenhum evento de webhook processado.");
}

/* ---------- Status do sistema ---------- */

function systemItems() {
    const s = state.system;
    return [
        { name: "API", value: s ? "Online" : "Sem resposta", level: s ? "ok" : "err",
          note: "Servidor Express, verificado em GET /status" },
        { name: "MySQL", value: !s ? "Indisponível" : s.banco === "online" ? "Conectado" : "Sem conexão",
          level: !s ? "na" : s.banco === "online" ? "ok" : "err", note: "Consulta de teste ao banco de dados" },
        { name: "Webhook", value: !s ? "Indisponível" : s.webhook === "configurado" ? "Ativo" : "Sem token",
          level: !s ? "na" : s.webhook === "configurado" ? "ok" : "err",
          note: "Token de autenticação configurado no servidor" }
    ];
}

function renderSystem() {
    const items = systemItems();
    const color = { ok: "var(--approved)", err: "var(--rejected)", na: "var(--cancelled)" };
    $("#indicators").replaceChildren(...items.map((item) =>
        h("span", { class: `ind ${item.level}` }, h("i"), item.name.toUpperCase(), h("b", {}, item.value.toUpperCase()))));
    const cards = () => items.map((item) => h("div", { class: "stat", style: `--c:${color[item.level]}` },
        h("span", {}, item.name), h("b", {}, item.value), h("small", {}, item.note)));
    $("#system-cards").replaceChildren(...cards());
    $("#overview-system").replaceChildren(h("div", { class: "stats system" }, ...cards()));
    $("#system-meta").textContent = state.system
        ? `Última verificação: ${formatDate(state.system.horario)} (horário informado pelo servidor).`
        : "O servidor não respondeu à última verificação.";
}

/* ---------- Criar pagamento ---------- */

function renderCreated(payment) {
    const node = payment
        ? h("div", {}, details(payment), h("div", { class: "actions" },
            h("button", { class: "btn", type: "button", onclick: () => goToMonitor(payment.id) }, "Simular notificação")))
        : empty("Aguardando operação", "Os dados da cobrança aparecem aqui depois da criação.");
    $("#created").replaceChildren(node);
}

$("#payment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const error = $("#form-error");
    const cliente = form.cliente.value.trim();
    const valor = Number(form.valor.value);
    if (!cliente) { error.textContent = "Informe o nome do cliente."; return form.cliente.focus(); }
    if (!form.valor.value || !Number.isFinite(valor) || valor <= 0) {
        error.textContent = "Informe um valor maior que zero.";
        return form.valor.focus();
    }
    error.textContent = "";
    withLoading($("#create-button"), async () => {
        try {
            const data = await api("/pagamentos", postJson({ cliente, valor }));
            renderCreated(data.pagamento);
            form.reset();
            toast("Cobrança de demonstração criada.");
            refreshAll();
        } catch (failure) {
            error.textContent = failure.message;
        }
    });
});

/* ---------- Pagamentos ---------- */

function renderFilters() {
    const options = [["", "Todos"], ...Object.entries(LABEL)];
    $("#filters").replaceChildren(...options.map(([value, label]) =>
        h("button", {
            type: "button",
            "aria-pressed": String(state.filter === value),
            onclick: () => { state.filter = value; renderFilters(); loadList(); }
        }, label)));
}

function renderList() {
    const term = $("#search").value.trim().toLowerCase();
    const items = state.list.filter((payment) =>
        !term || payment.cliente.toLowerCase().includes(term) || payment.id.toLowerCase().includes(term));
    $("#list-meta").textContent = `${items.length} de ${state.list.length} pagamento(s) exibidos.`;
    const node = items.length
        ? table(["ID", "Cliente", "#Valor", "Status", "Criado em", ""], items.map((payment) => [
            idCell(payment.id), payment.cliente, money.format(payment.valor), statusTag(payment.status),
            formatDate(payment.criadoEm),
            h("button", { class: "btn small", type: "button", onclick: () => openDetails(payment.id) }, "Detalhes")
        ]))
        : empty("Nenhum pagamento", state.list.length ? "Nenhum resultado para a busca." : "Não há pagamentos com este filtro.");
    $("#list").replaceChildren(node);
}

async function openDetails(id) {
    const body = $("#modal-body");
    body.replaceChildren(empty("Carregando", "Consultando o pagamento..."));
    $("#modal").showModal();
    try {
        const payment = await api(`/pagamentos/${id}`);
        const events = state.events.filter((event) => event.pagamentoId === id);
        body.replaceChildren(
            details(payment),
            h("h3", {}, "Eventos de webhook deste pagamento"),
            events.length
                ? table(["Evento", "Novo status", "Recebido em"], events.map((event) =>
                    [h("span", { class: "mono" }, event.eventoId), statusTag(event.status), formatDate(event.recebidoEm)]))
                : empty("Sem eventos", "Nenhuma notificação processada para este pagamento."),
            h("div", { class: "actions" }, h("button", {
                class: "btn primary", type: "button",
                onclick: () => { $("#modal").close(); goToMonitor(id); }
            }, "Simular notificação"))
        );
    } catch (error) {
        body.replaceChildren(empty("Falha na consulta", error.message, true));
    }
}

/* ---------- Monitor de webhook ---------- */

function goToMonitor(id) {
    location.hash = "#monitor";
    $("#sim-payment").value = id;
}

function renderMonitor() {
    const select = $("#sim-payment");
    const selected = select.value;
    select.replaceChildren(...state.payments.map((payment) => h("option", { value: payment.id },
        `${payment.cliente} · ${money.format(payment.valor)} · ${LABEL[payment.status]} · ${shortId(payment.id)}`)));
    if (state.payments.some((payment) => payment.id === selected)) select.value = selected;
    const none = state.payments.length === 0;
    $("#sim-send").disabled = none;
    $("#sim-token").disabled = none;
    if (none) select.replaceChildren(h("option", { value: "" }, "Nenhum pagamento cadastrado"));

    $("#event-history").replaceChildren(
        state.error ? empty("Dados indisponíveis", state.error, true)
        : state.events.length ? table(["Evento", "Pagamento", "Cliente", "Novo status", "Resultado", "Recebido em"],
            state.events.map((event) => [
                h("span", { class: "mono" }, event.eventoId), idCell(event.pagamentoId), clientName(event.pagamentoId),
                statusTag(event.status), "Processado", formatDate(event.recebidoEm)
            ]))
        : empty("Sem eventos", "Nenhum evento de webhook foi processado até agora."));
    renderLog();
}

function renderLog() {
    const kinds = { ok: "Processado", dup: "Duplicado · recusado", fail: "Erro" };
    $("#session-log").replaceChildren(...(state.log.length ? state.log.map((entry) =>
        h("li", { class: entry.kind },
            h("div", { class: "head" },
                h("span", {}, `${entry.kind === "fail" && entry.http === 401 ? "Falha de autenticação" : kinds[entry.kind]} · HTTP ${entry.http || "—"}`),
                h("time", {}, entry.time)),
            h("p", {}, `Evento ${entry.eventoId} → pagamento ${shortId(entry.pagamentoId)}`),
            h("p", {}, `Status anterior: ${LABEL[entry.previous]} · solicitado: ${LABEL[entry.requested]}`),
            h("p", {}, entry.message)))
        : [h("li", { class: "empty" }, h("b", {}, "Sem atividade"), "Envie uma notificação para iniciar o registro.")]));
}

// Envia a notificação e registra a resposta real do servidor.
async function sendEvent(button, { eventoId, pagamentoId, status }, invalidToken = false) {
    const payment = state.payments.find((item) => item.id === pagamentoId);
    await withLoading(button, async () => {
        const result = invalidToken
            // Token propositalmente errado, enviado direto ao webhook: demonstra a rejeição (401).
            ? await request("/webhook/pagamento", postJson({ pagamentoId, status, eventoId }, { "x-webhook-token": "token-invalido-demo" }))
            : await request(`/pagamentos/${pagamentoId}/simular`, postJson({ status, eventoId }));

        const kind = result.ok ? "ok" : result.status === 409 ? "dup" : "fail";
        state.log.unshift({
            kind, http: result.status, eventoId, pagamentoId, requested: status, previous: payment.status,
            time: new Date().toLocaleTimeString("pt-BR"),
            message: result.ok ? `${result.data.mensagem}. Status atual: ${LABEL[result.data.pagamento.status]}.` : result.data.erro
        });
        if (!invalidToken) {
            state.lastEvent = { eventoId, pagamentoId, status };
            $("#sim-repeat").disabled = false;
        }
        if (result.ok) {
            const tag = statusTag(result.data.pagamento.status);
            tag.classList.add("changed");
            $("#sim-result").replaceChildren(details(result.data.pagamento));
            $("#sim-result .st").replaceWith(tag);
            toast("Notificação processada: status atualizado.");
        } else {
            toast(result.data.erro || "Notificação recusada.", true);
        }
        await refreshAll();
    });
}

const newEvent = () => ({
    eventoId: `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    pagamentoId: $("#sim-payment").value,
    status: $("#sim-status").value
});

$("#sim-send").addEventListener("click", (event) => sendEvent(event.currentTarget, newEvent()));
$("#sim-repeat").addEventListener("click", (event) => sendEvent(event.currentTarget, state.lastEvent));
$("#sim-token").addEventListener("click", (event) => sendEvent(event.currentTarget, newEvent(), true));

/* ---------- Navegação e inicialização ---------- */

function navigate() {
    const view = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "overview";
    for (const name of Object.keys(VIEWS)) $(`#view-${name}`).hidden = name !== view;
    document.querySelectorAll(".sidebar nav a").forEach((link) =>
        link.dataset.view === view ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current"));
    $("#page-title").textContent = $("#crumb").textContent = VIEWS[view];
    document.title = `${VIEWS[view]} · Payment Operations`;
    document.body.classList.remove("nav-open");
}

$("#menu-btn").addEventListener("click", () =>
    document.body.classList.toggle(matchMedia("(max-width: 860px)").matches ? "nav-open" : "nav-collapsed"));
$("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
$("#modal-close").addEventListener("click", () => $("#modal").close());
$("#search").addEventListener("input", renderList);
$("#refresh-button").addEventListener("click", (event) => withLoading(event.currentTarget, loadList));
$("#system-refresh").addEventListener("click", (event) => withLoading(event.currentTarget, loadSystem));
window.addEventListener("hashchange", navigate);

function tick() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleString("pt-BR");
    $("#clock").dateTime = now.toISOString();
}

navigate();
renderFilters();
renderCreated(null);
tick();
setInterval(tick, 1000);
setInterval(loadSystem, 20000);
refreshAll();

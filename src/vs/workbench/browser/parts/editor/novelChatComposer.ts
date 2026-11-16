import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { URI } from '../../../../base/common/uri.js';

export type Profile = { id: string; name: string; provider: string; model: string; files?: string[]; roles?: string[]; instructions?: string; skillIds?: string[] };
type LibrarySkill = { id: string; name: string; description: string; library: string };
type AgentSelection = { agent: string; profiles?: Profile[] };
type ModelCatalog = { models: { id: string; label: string }[]; source: 'live' | 'cache' | 'bundled' | 'local' };
export async function openNovelChatComposer(accessor: ServicesAccessor, title: string, chapter: string, selection: AgentSelection, configOnly = false) {
	const commands = accessor.get(ICommandService);
	const host = accessor.get(ILayoutService).activeContainer;
	const doc = host.ownerDocument;
	const previous = doc.activeElement as HTMLElement | null;
	if (configOnly) {
		const existing = host.querySelector<HTMLElement>('.novel-profile-settings');
		if (existing) { existing.querySelector<HTMLElement>('input:not([hidden]), button')?.focus(); return; }
	}
	const panel = doc.createElement('section');
	panel.className = 'novel-native-composer interactive-session';
	panel.classList.toggle('novel-profile-settings', configOnly);
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-label', title);
	const header = doc.createElement('header');
	header.title = title + ' · 拖动窗口';
	function button(parent: HTMLElement, name: string, icon?: string) {
		const el = parent.appendChild(doc.createElement('button'));
		el.type = 'button';
		el.title = name;
		el.setAttribute('aria-label', name);
		if (icon) { el.className = 'codicon codicon-' + icon; } else { el.textContent = name; }
		return el;
	}
	const close = button(header, '关闭', 'close');
	header.style.cursor = 'grab';
	header.style.touchAction = 'none';
	header.onpointerdown = event => {
		if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest('button')) { return; }
		event.preventDefault();
		const rect = panel.getBoundingClientRect();
		const offsetX = event.clientX - rect.left;
		const offsetY = event.clientY - rect.top;
		header.setPointerCapture(event.pointerId);
		header.style.cursor = 'grabbing';
		header.onpointermove = move => {
			if (move.pointerId !== event.pointerId) { return; }
			const bounds = host.getBoundingClientRect();
			const x = Math.max(0, Math.min(move.clientX - offsetX - bounds.left, bounds.width - panel.offsetWidth));
			const y = Math.max(0, Math.min(move.clientY - offsetY - bounds.top, bounds.height - panel.offsetHeight));
			panel.style.transform = 'none';
			panel.style.left = x + 'px';
			panel.style.top = y + 'px';
		};
		header.onlostpointercapture = () => {
			header.onpointermove = null;
			header.style.cursor = 'grab';
		};
	};
	const form = panel.appendChild(doc.createElement('form'));
	form.className = 'chat-input-container';
	form.appendChild(header);
	const chips = header.insertBefore(doc.createElement('div'), close);
	chips.className = 'novel-files chat-attached-context';
	const chapterPath = chapter ? URI.parse(chapter).fsPath : '';
	if (configOnly) {
		const heading = header.insertBefore(doc.createElement('strong'), chips);
		heading.textContent = '模型配置';
	}
	const files = new Set<string>();
	const drawFiles = () => {
		chips.replaceChildren();
		for (const file of [chapterPath, ...files].filter(Boolean)) {
			const label = file.split(/[\\/]/).pop() || file;
			const chip = chips.appendChild(doc.createElement('span'));
			chip.className = 'chat-attached-context-attachment';
			chip.appendChild(doc.createElement('i')).className = 'codicon codicon-markdown';
			chip.append(label);
			chip.title = file;
			if (file !== chapterPath) {
				button(chip, '移除 ' + label, 'close').onclick = () => { files.delete(file); drawFiles(); };
			}
		}
	};
	drawFiles();
	const prompt = form.appendChild(doc.createElement('textarea'));
	prompt.setAttribute('aria-label', '写作要求');
	prompt.rows = 3;
	prompt.placeholder = title.includes('选段') ? '希望这段怎么改？' : '这一章想写什么？';
	const bar = form.appendChild(doc.createElement('footer'));
	button(bar, '添加文本附件', 'add').onclick = async () => {
		const paths = await commands.executeCommand<string[]>('workhub.novel.pickWritingFiles');
		for (const file of paths ?? []) { if (file !== chapterPath) { files.add(file); } }
		drawFiles();
	};
	bar.className = 'chat-input-toolbars';
	const picker = button(bar, '选择写作 Agent');
	const labels: Record<string, string> = { codex: 'Codex', agy: 'Antigravity', claude: 'Claude', gemini: 'Gemini' };
	const menu = panel.appendChild(doc.createElement('section'));
	menu.className = 'novel-agent-menu';
	menu.hidden = true;
	function update() {
		picker.textContent = 'Agent · ' + labels[selection.agent] + ' ▾';
		for (const item of menu.querySelectorAll('button')) {
			item.setAttribute('aria-pressed', String(item.value === selection.agent));
		}
	}
	function hideMenu() {
		menu.hidden = true;
		picker.setAttribute('aria-expanded', 'false');
	}
	const builtins = Object.entries(labels);
	const profiles = selection.profiles ?? [];
	for (const profile of profiles) { labels[profile.id] = profile.name; }
	const tools = menu.appendChild(doc.createElement('div'));
	tools.className = 'novel-agent-tools';
	const badge = tools.appendChild(doc.createElement('b'));
	badge.className = 'novel-agent-badge';
	badge.appendChild(doc.createElement('i')).className = 'codicon codicon-agent';
	badge.append(configOnly ? '写作 Agent' : '模型配置');
	const manageLibrary = button(tools, 'Skill 管理');
	const add = button(tools, '新增 Agent', 'add');
	const find = button(tools, '搜索 Agent', 'search');
	const search = menu.appendChild(doc.createElement('input'));
	search.placeholder = '搜索 Agent';
	search.setAttribute('aria-label', search.placeholder);
	search.hidden = true;
	find.onclick = () => {
		search.hidden = !search.hidden;
		if (search.hidden) { search.value = ''; list(); } else { search.focus(); }
	};
	const rows = menu.appendChild(doc.createElement('div'));
	const editor = menu.appendChild(doc.createElement('form'));
	editor.hidden = true;
	const name = editor.appendChild(doc.createElement('input'));
	name.placeholder = 'Agent 名称';
	name.required = true;
	const provider = editor.appendChild(doc.createElement('select'));
	provider.setAttribute('aria-label', '服务');
	for (const [id, label] of builtins) { provider.add(new Option(label, id)); }
	const model = editor.appendChild(doc.createElement('select'));
	model.setAttribute('aria-label', '模型');
	const catalogInfo = editor.appendChild(doc.createElement('div'));
	catalogInfo.className = 'novel-model-catalog';
	const modelStatus = catalogInfo.appendChild(doc.createElement('span'));
	modelStatus.setAttribute('role', 'status');
	const retry = button(catalogInfo, '重新加载模型列表');
	let modelRequest = 0;
	let savedProvider = '', savedModel = '';
	function showModels(models: ModelCatalog['models'], selected: string) {
		model.replaceChildren(new Option('使用服务默认模型', ''));
		const ids = new Set<string>(['']);
		for (const { id, label } of models) {
			if (ids.has(id)) { continue; }
			ids.add(id);
			const option = new Option(label && id !== label ? label + '（' + id + '）' : id, id);
			model.add(option);
		}
		const previous = savedProvider === provider.value ? savedModel : '';
		for (const id of [previous, selected]) {
			if (!ids.has(id)) {
				model.add(new Option(id + (id === previous ? '（原配置）' : '（当前选择）'), id));
				ids.add(id);
			}
		}
		model.value = selected;
	}
	async function loadModels(reset: boolean) {
		const request = ++modelRequest;
		const service = provider.value;
		if (reset) { showModels([], savedProvider === service ? savedModel : ''); }
		retry.hidden = true;
		const loading = '正在加载 ' + service + ' 模型…';
		modelStatus.textContent = loading;
		// Antigravity can take seconds to answer. Its cached or bundled list is selectable throughout refresh.
		const phases = service === 'agy' ? [false, true] : [false];
		for (const refresh of phases) {
			try {
				const catalog = await commands.executeCommand<ModelCatalog>('workhub.novel.modelCatalog', service, refresh);
				if (request !== modelRequest) { return; }
				if (!catalog?.models.length) { throw new Error('未找到可选模型'); }
				showModels(catalog.models, model.value);
				const source = { live: '实时列表', cache: '缓存列表', bundled: '内置列表', local: '本机列表' }[catalog.source];
				const count = source + ' · ' + catalog.models.length + ' 个模型';
				modelStatus.textContent = service === 'agy' && !refresh ? loading + ' 当前可用' + count : count;
			} catch (cause) {
				if (request !== modelRequest) { return; }
				if (service === 'agy' && !refresh) { continue; }
				const detail = cause instanceof Error ? cause.message : String(cause);
				modelStatus.textContent = service + ' 模型列表加载失败。' + detail;
				retry.hidden = false;
			}
		}
	}
	provider.onchange = () => void loadModels(true);
	retry.onclick = () => void loadModels(false);
	const heading = doc.createElement('h4');
	heading.textContent = '新增写作 Agent';
	editor.prepend(heading);
	for (const [caption, field] of [['名称', name], ['服务', provider], ['模型', model]] as const) {
		const label = doc.createElement('label');
		field.before(label);
		label.append(caption, field);
	}
	const roleLabel = editor.appendChild(doc.createElement('label'));
	roleLabel.append('角色标签');
	const roleInput = roleLabel.appendChild(doc.createElement('input'));
	roleInput.placeholder = '如：写手、大纲，可输入多个标签';
	const roleButtons = editor.appendChild(doc.createElement('div'));
	roleButtons.className = 'novel-role-picks';
	const roleValues = () => [...new Set(roleInput.value.split(/[,，、;；\n]+/u).map(tag => tag.trim()).filter(Boolean))];
	function updateRoleButtons() {
		const values = roleValues();
		for (const item of roleButtons.querySelectorAll('button')) {
			item.setAttribute('aria-pressed', String(values.includes(item.textContent ?? '')));
		}
	}
	for (const role of ['写手', '大纲', '编辑', '质检']) {
		const item = button(roleButtons, role);
		item.onclick = () => {
			const values = roleValues();
			roleInput.value = (values.includes(role) ? values.filter(tag => tag !== role) : [...values, role]).join('、');
			updateRoleButtons();
		};
	}
	roleInput.oninput = updateRoleButtons;
	let editingId = '';
	let attached: string[] = [];
	const fileSection = editor.appendChild(doc.createElement('div'));
	const fileTitle = fileSection.appendChild(doc.createElement('h4'));
	fileTitle.textContent = 'Agent / Skill';
	const skillBox = fileSection.appendChild(doc.createElement('fieldset'));
	skillBox.className = 'novel-skill-picker';
	skillBox.appendChild(doc.createElement('legend')).textContent = '选择 Skill';
	const skillToolbar = skillBox.appendChild(doc.createElement('div'));
	skillToolbar.className = 'novel-skill-toolbar';
	const filter = skillToolbar.appendChild(doc.createElement('input'));
	filter.type = 'search';
	filter.placeholder = '搜索 Skill 名称或说明';
	filter.setAttribute('aria-label', '搜索 Skill');
	const manageSelection = button(skillToolbar, 'Skill 管理');
	const skillList = skillBox.appendChild(doc.createElement('div'));
	skillList.className = 'novel-skill-list';
	const skillStatus = skillBox.appendChild(doc.createElement('div'));
	skillStatus.className = 'novel-skill-status';
	skillStatus.setAttribute('role', 'status');
	let selectedSkills = new Set<string>();
	let availableSkills: LibrarySkill[] = [];
	let catalogRequest = 0;

	function drawLibrarySkills() {
		skillList.replaceChildren();
		const availableIds = new Set(availableSkills.map(skill => skill.id));
		const missing = [...selectedSkills].filter(id => !availableIds.has(id));
		const entries = [...availableSkills, ...missing.map(id => ({
			id, name: (id.split(/[\\/]/).at(-2) || id) + '（未在技能库中找到）', description: id, library: ''
		}))];
		const words = filter.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
		const names = new Set<string>();
		const duplicates = new Set<string>();
		for (const { name } of entries) {
			if (names.has(name)) { duplicates.add(name); }
			names.add(name);
		}
		for (const skill of entries) {
			const searchable = [skill.name, skill.description, skill.id].join(' ').toLowerCase();
			if (!words.every(word => searchable.includes(word))) { continue; }
			const row = skillList.appendChild(doc.createElement('label'));
			row.title = skill.id;
			const check = row.appendChild(doc.createElement('input'));
			check.type = 'checkbox';
			check.checked = selectedSkills.has(skill.id);
			check.setAttribute('aria-label', duplicates.has(skill.name) ? skill.name + ' · ' + skill.id : skill.name);
			const detail = row.appendChild(doc.createElement('span'));
			detail.appendChild(doc.createElement('strong')).textContent = skill.name;
			detail.appendChild(doc.createElement('small')).textContent = duplicates.has(skill.name) ? skill.id : skill.description;
			check.onchange = () => {
				if (check.checked) { selectedSkills.add(skill.id); } else { selectedSkills.delete(skill.id); }
				skillStatus.textContent = '已选择 ' + selectedSkills.size + ' 个 Skill';
				if (!availableIds.has(skill.id) && !check.checked) { row.remove(); }
			};
		}
		const hint = skillList.childElementCount ? '' : words.length ? '没有匹配的 Skill。' : '技能库为空，可在「Skill 管理」中添加目录。';
		skillStatus.textContent = hint + '已选择 ' + selectedSkills.size + ' 个 Skill';
	}
	filter.oninput = drawLibrarySkills;
	async function loadSkills() {
		const request = ++catalogRequest;
		skillStatus.textContent = '正在读取技能库…';
		try {
			const catalog = await commands.executeCommand<{ skills: LibrarySkill[] }>('workhub.novel.skillLibrary.catalog');
			if (catalogRequest !== request) { return; }
			if (!catalog) { throw new Error('未收到技能库列表'); }
			availableSkills = catalog.skills;
			drawLibrarySkills();
		} catch (cause) {
			if (catalogRequest === request) { skillStatus.textContent = '技能库读取失败。' + String(cause); }
		}
	}
	async function manageSkills() {
		try {
			await commands.executeCommand('workhub.novel.manageSkills');
		} finally {
			if (!editor.hidden && panel.isConnected) { await loadSkills(); }
		}
	}
	manageLibrary.onclick = manageSelection.onclick = manageSkills;
	const instructionLabel = fileSection.appendChild(doc.createElement('label'));
	instructionLabel.append('直接输入指令');
	const instructions = instructionLabel.appendChild(doc.createElement('textarea'));
	instructions.rows = 4;
	instructions.placeholder = '输入或粘贴角色要求、写作规则或 Skill 内容，可与绑定文件一起使用。';
	const fileRows = fileSection.appendChild(doc.createElement('div'));
	function drawSkills() {
		fileRows.replaceChildren();
		for (const file of attached) {
			const row = fileRows.appendChild(doc.createElement('div'));
			row.className = 'novel-skill-row';
			const open = button(row, file.split(/[\\/]/).pop() || file);
			open.title = file;
			open.onclick = () => commands.executeCommand('workhub.novel.editSkillFile', file);
			button(row, '解除绑定', 'close').onclick = () => { attached = attached.filter(p => p !== file); drawSkills(); };
		}
	}
	button(fileSection, '绑定文件', 'attach').onclick = async () => {
		const files = await commands.executeCommand<string[]>('workhub.novel.pickSkillFiles');
		attached = [...new Set([...attached, ...files ?? []])];
		drawSkills();
	};
	button(fileSection, '新建 Skill 文件', 'new-file').onclick = async () => {
		const file = await commands.executeCommand<string>('workhub.novel.createSkillFile');
		if (file) { attached = [...new Set([...attached, file])]; drawSkills(); }
	};
	const error = editor.appendChild(doc.createElement('div'));
	error.setAttribute('role', 'alert');
	const save = button(editor, '保存 Agent');
	save.type = 'submit';
	function list() {
		modelRequest++;
		catalogRequest++;
		editor.hidden = true;
		tools.hidden = false;
		rows.hidden = false;
		rows.replaceChildren();
		const tableHeader = rows.appendChild(doc.createElement('div'));
		tableHeader.className = 'novel-agent-row novel-agent-columns';
		for (const title of ['名称', '角色', '模型', 'Skill / 文件', '操作']) { tableHeader.appendChild(doc.createElement('span')).textContent = title; }
		for (const [agent, label] of Object.entries(labels)) {
			const profile = profiles.find(p => p.id === agent);
			const detail = profile?.model || '默认';
			if (![label, detail, ...(profile?.roles ?? [])].join(' ').toLowerCase().includes(search.value.toLowerCase())) { continue; }
			const row = rows.appendChild(doc.createElement('div'));
			row.className = 'novel-agent-row';
			const item = button(row, label);
			item.value = agent;
			const editRow = () => edit(profile ?? { id: agent, name: label, provider: agent, model: '', files: [] });
			item.onclick = configOnly ? editRow : () => choose(agent);
			const tags = row.appendChild(doc.createElement('span'));
			tags.className = 'novel-role-cell';
			tags.textContent = profile?.roles?.join(' · ') || '—';
			tags.title = tags.textContent;
			const modelCell = row.appendChild(doc.createElement('span'));
			modelCell.textContent = profile ? detail : '未配置';
			modelCell.title = profile ? [profile.provider, detail].join(' · ') : '保存后可在章节流程中使用。添加「质检」标签后也会出现在文章质检菜单中。';
			const bindings = row.appendChild(doc.createElement('span'));
			bindings.textContent = (profile?.skillIds?.length ?? 0) + ' / ' + (profile?.files?.length ?? 0);
			bindings.title = '已选 Skill / 附加文件';
			const actions = row.appendChild(doc.createElement('div'));
			button(actions, '编辑 ' + label, 'gear').onclick = editRow;
			if (profile) {
				const remove = button(actions, '移除 ' + label + ' 配置', 'trash');
				remove.onclick = async () => {
					if (remove.dataset.confirm !== 'true') { remove.dataset.confirm = 'true'; remove.className = ''; remove.textContent = '确认删除'; return; }
					await commands.executeCommand('workhub.novel.deleteWritingProfile', agent);
					profiles.splice(profiles.indexOf(profile), 1);
					const builtin = builtins.find(([id]) => id === agent);
					if (builtin) { labels[agent] = builtin[1]; } else { delete labels[agent]; }
					if (selection.agent === agent) { selection = { agent: 'codex' }; }
					list();
				};
			}
		}
		update();
	}
	async function choose(agent: string) {
		selection = { agent };
		update();
		hideMenu();
		prompt.focus();
		await commands.executeCommand('workhub.novel.saveWritingAgent', agent);
	}
	search.oninput = list;
	function edit(profile?: Profile) {
		tools.hidden = rows.hidden = search.hidden = true;
		editor.hidden = false;
		editingId = profile?.id ?? '';
		heading.textContent = profile ? '编辑写作 Agent' : '新增写作 Agent';
		name.value = profile?.name ?? '';
		roleInput.value = (profile?.roles ?? []).join('、');
		updateRoleButtons();
		provider.value = profile?.provider ?? 'codex';
		attached = [...profile?.files ?? []];
		selectedSkills = new Set(profile?.skillIds);
		filter.value = '';
		availableSkills = [];
		skillList.replaceChildren();
		void loadSkills();
		instructions.value = profile?.instructions ?? '';
		error.textContent = '';
		drawSkills();
		savedProvider = provider.value;
		savedModel = profile?.model ?? '';
		void loadModels(true);
		name.focus();
	}
	add.onclick = () => edit();
	button(editor, '取消').onclick = list;
	editor.onsubmit = async event => {
		event.preventDefault();
		if (save.disabled || !name.value.trim()) { return; }
		save.disabled = true;
		try {
			const profile = await commands.executeCommand<Profile>('workhub.novel.storeWritingProfile', {
				id: editingId, name: name.value, provider: provider.value, model: model.value,
				files: attached, roles: roleValues(), instructions: instructions.value, skillIds: [...selectedSkills]
			});
			if (profile) { const index = profiles.findIndex(p => p.id === profile.id);
				if (index >= 0) { profiles[index] = profile; } else { profiles.push(profile); }
				labels[profile.id] = profile.name;
				if (configOnly) { list(); add.focus(); } else { await choose(profile.id); }
			}
		} catch (cause) { error.textContent = String(cause); } finally { save.disabled = false; }
	};
	update();
	picker.setAttribute('aria-expanded', 'false');
	picker.onclick = () => {
		if (!menu.hidden) { hideMenu(); return; }
		menu.hidden = false;
		search.hidden = true;
		search.value = '';
		list();
		picker.setAttribute('aria-expanded', 'true');
		menu.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
	};
	const outside = (event: PointerEvent) => {
		if ((event.target as Element).closest('.novel-skill-manager')) { return; }
		if (!configOnly && !menu.contains(event.target as Node) && !picker.contains(event.target as Node)) { hideMenu(); }
	};
	doc.addEventListener('pointerdown', outside, true);
	const send = button(bar, '发送', 'arrow-up');
	send.type = 'submit';
	form.onfocusin = () => form.classList.add('focused');
	form.onfocusout = event => form.classList.toggle('focused', form.contains(event.relatedTarget as Node | null));
	host.appendChild(panel);
	if (configOnly) {
		menu.hidden = false;
		list();
		add.focus();
	} else { prompt.focus(); }
	try {
		return await new Promise<(AgentSelection & { instruction: string; files: string[] }) | undefined>(resolve => {
			close.onclick = () => resolve(undefined);
			panel.onkeydown = event => {
				if (event.isComposing) { return; }
				if (configOnly) {
					if (event.key === 'Escape') {
						event.preventDefault();
						if (!editor.hidden) { list(); add.focus(); } else { resolve(undefined); }
					}
					return;
				}
				if (!menu.hidden && event.key === 'Escape') { event.preventDefault(); hideMenu(); picker.focus(); return; }
				if (menu.contains(event.target as Node)) { return; }
				if (event.key === 'Escape') { resolve(undefined); }
				if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); form.requestSubmit(); }
			};
			form.onsubmit = event => { event.preventDefault(); resolve({ ...selection, instruction: prompt.value, files: [...files] }); };
		});
	} finally {
		modelRequest++;
		catalogRequest++;
		doc.removeEventListener('pointerdown', outside, true);
		panel.remove();
		previous?.focus();
	}
}

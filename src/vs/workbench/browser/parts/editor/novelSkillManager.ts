import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';

type Catalog = {
	libraries: { path: string; kind: 'added' | 'discovered' }[];
	skills: { id: string; name: string; description: string; library: string }[];
	warnings: string[];
};

export async function openNovelSkillManager(accessor: ServicesAccessor, agents: { name: string; skillIds: string[] }[]) {
	const commands = accessor.get(ICommandService);
	const host = accessor.get(ILayoutService).activeContainer;
	const doc = host.ownerDocument;
	const existing = host.querySelector<HTMLDialogElement>('dialog.novel-skill-manager');
	if (existing) { existing.querySelector<HTMLInputElement>('input')?.focus(); return; }
	const panel = doc.createElement('dialog');
	panel.className = 'novel-skill-manager';
	panel.setAttribute('aria-label', 'Skill 管理');
	function element<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, value = '') {
		const node = parent.appendChild(doc.createElement(tag));
		if (value) { node.textContent = value; }
		return node;
	}
	function button(parent: HTMLElement, label: string, action: () => void) {
		const node = element(parent, 'button', label);
		node.type = 'button';
		node.onclick = action;
		return node;
	}
	const header = element(panel, 'header');
	element(header, 'h2', 'Skill 管理');
	button(header, '关闭', () => panel.close());
	const toolbar = element(panel, 'nav');
	const zip = button(toolbar, '导入 ZIP…', () => void update('importZip'));
	zip.className = 'primary';
	button(toolbar, '添加目录…', () => void update('add'));
	button(toolbar, '刷新', () => void update('catalog'));
	const sources = element(panel, 'details');
	const sourceTitle = element(sources, 'summary', '技能库来源');
	const sourceList = element(sources, 'div');
	const filter = element(panel, 'input');
	filter.type = 'search';
	filter.placeholder = '搜索名称、题材或说明';
	filter.setAttribute('aria-label', filter.placeholder);
	const status = element(panel, 'div');
	status.className = 'skill-count';
	status.setAttribute('role', 'status');
	const list = element(panel, 'div');
	list.className = 'skill-cards';
	const warnings = element(panel, 'div');
	warnings.className = 'skill-warnings';
	warnings.setAttribute('role', 'alert');
	let snapshot: Catalog | undefined;
	let busy = false;

	function renderSkills() {
		if (!snapshot) { return; }
		list.replaceChildren();
		const words = filter.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
		for (const skill of snapshot.skills) {
			const searchable = [skill.name, skill.description, skill.id].join(' ').toLowerCase();
			if (!words.every(word => searchable.includes(word))) { continue; }
			const card = element(list, 'article');
			const title = element(card, 'div');
			title.className = 'skill-title';
			element(title, 'strong', skill.name);
			button(title, '打开说明', async () => {
				try { await commands.executeCommand('workhub.novel.editSkillFile', skill.id); panel.close(); }
				catch (cause) { warnings.textContent = String(cause); }
			});
			element(card, 'p', skill.description);
			const bound = agents.filter(agent => agent.skillIds.includes(skill.id)).map(agent => agent.name);
			element(card, 'small', bound.length ? '已绑定 · ' + bound.join('、') : '尚未绑定 Agent');
			const path = element(card, 'small', skill.id);
			path.title = skill.id;
		}
		status.textContent = words.length ? '找到 ' + list.childElementCount + ' 个，共 ' + snapshot.skills.length + ' 个 Skill' : '共 ' + snapshot.skills.length + ' 个 Skill';
		if (!list.childElementCount) { element(list, 'p', words.length ? '没有找到匹配的 Skill。' : '可导入含 SKILL.md 的 ZIP，或添加本地技能库目录。'); }
	}

	async function update(action: string, path?: string) {
		if (busy) { return; }
		busy = true;
		const buttons = [...toolbar.querySelectorAll('button'), ...sourceList.querySelectorAll('button')];
		buttons.forEach(node => node.disabled = true);
		status.textContent = action === 'importZip' ? '请选择 ZIP，正在等待导入…' : '正在读取技能库…';
		warnings.textContent = '';
		try {
			const result = await commands.executeCommand<Catalog>('workhub.novel.skillLibrary.' + action, ...(path ? [path] : []));
			if (!result) { throw new Error('未收到技能库列表'); }
			snapshot = result;
			sourceTitle.textContent = '技能库来源（' + result.libraries.length + '）';
			sourceList.replaceChildren();
			for (const lib of result.libraries) {
				const source = element(sourceList, 'div');
				element(source, 'span', (lib.kind === 'added' ? '已添加 · ' : '自动发现 · ') + lib.path);
				if (lib.kind === 'added') {
					const remove = button(source, '移除来源', () => void update('remove', lib.path));
					remove.title = '从列表移除，保留磁盘文件';
				}
			}
			warnings.textContent = result.warnings.join('\n');
			renderSkills();
		} catch (cause) {
			if (snapshot) { renderSkills(); } else { status.textContent = ''; }
			warnings.textContent = String(cause);
		} finally {
			busy = false;
			buttons.forEach(node => node.disabled = false);
		}
	}

	filter.oninput = renderSkills;
	host.appendChild(panel);
	const closed = new Promise<void>(resolve => { panel.onclose = () => resolve(); });
	try {
		panel.showModal();
		filter.focus();
		void update('catalog');
		await closed;
	} finally { panel.remove(); }
}

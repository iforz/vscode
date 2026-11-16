/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';

type MenuProfile = {
	id: string;
	name: string;
	provider: string;
	model: string;
	roles?: string[];
};

const menu = MenuId.for('api:workhub.novel.analysisAgents');
const entries = new DisposableStore();

CommandsRegistry.registerCommand('_workhub.novel.syncAnalyzeMenu', (_accessor, profiles: MenuProfile[]) => {
	entries.clear();
	const reviewers = profiles.filter(profile => profile.roles?.includes('质检'));
	if (!reviewers.length) {
		entries.add(MenuRegistry.appendMenuItem(menu, {
			command: { id: 'workhub.novel.configureAgents', title: '配置带「质检」标签的 Agent…' }
		}));
		return;
	}
	for (const [order, profile] of reviewers.entries()) {
		const id = '_workhub.novel.analyzeWith.' + profile.id;
		const detail = [...(profile.roles ?? []), profile.model || profile.provider].filter(Boolean).join(' · ');
		const title = detail ? profile.name + '（' + detail + '）' : profile.name;
		entries.add(CommandsRegistry.registerCommand(id, (accessor, resource?: URI) =>
			accessor.get(ICommandService).executeCommand('workhub.novel.analyze', profile.id, resource)));
		entries.add(MenuRegistry.appendMenuItem(menu, { command: { id, title }, group: 'agents', order: order + 1 }));
	}
});

import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { Profile } from './novelChatComposer.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';

CommandsRegistry.registerCommand('workhub.openNovelChatComposer', async (accessor, title: string, chapter: string, selection: { agent: string }) => {
	const service = accessor.get(IInstantiationService);
	const { openNovelChatComposer } = await import('./novelChatComposer.js');
	return service.invokeFunction(openNovelChatComposer, title, chapter, selection);
});

CommandsRegistry.registerCommand('workhub.openNovelAgentConfiguration', async (accessor, profiles: Profile[]) => {
	const service = accessor.get(IInstantiationService);
	const { openNovelChatComposer } = await import('./novelChatComposer.js');
	await service.invokeFunction(openNovelChatComposer, '模型配置', '', { agent: '', profiles }, true);
});

CommandsRegistry.registerCommand('workhub.openNovelSkillManager', async (accessor, agents: { name: string; skillIds: string[] }[] = []) => {
	const service = accessor.get(IInstantiationService);
	const { openNovelSkillManager } = await import('./novelSkillManager.js');
	return service.invokeFunction(openNovelSkillManager, agents);
});

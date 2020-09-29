/**
 * @fileoverview Description of this file.
 */

/**
 * Removes Move change from UI, regardless of Gerrit configuration.
 * @param {Plugin} plugin: the plugin object
 * @param {ChangeInfo} change: the object for the current change
 */
export async function hideMoveChange(plugin, change) {
  const changeActions = plugin.changeActions();
  changeActions.setActionHidden(
      changeActions.ActionType.CHANGE, changeActions.ChangeActions.MOVE, true);
}

'use strict';

//'.1.7.' містить '.1.7.20.'

const { toTime } = require('./calendar');

function isInSubtree(taskPath, rootPath) {
  return typeof taskPath === 'string' && taskPath.startsWith(rootPath);
}

//групу утворює планова робота
function assignMaintenanceGroups(tasks, { dayEnd }) {
  const end = toTime(dayEnd);
  const isOpen = (task) => toTime(task.r) <= end;

  const roots = tasks
    .filter((task) => task.source === 'PLANNED' && isOpen(task) && task.treePath)
    .map((task) => ({ equipmentId: task.equipmentId, treePath: task.treePath }));

  //корінь — найвищий рівень
  const highest = roots.filter(
    (root) => !roots.some((other) => other.treePath !== root.treePath && isInSubtree(root.treePath, other.treePath))
  );

  const groups = new Map();

  for (const task of tasks) {
    const root = isOpen(task) ? highest.find((candidate) => isInSubtree(task.treePath, candidate.treePath)) : undefined;
    groups.set(task.taskId, root ? root.equipmentId : null);
  }

  return groups;
}

//кінець робочого дня закриває будь-яку групу
function groupUnderWay(lastTask, dayStart) {
  if (!lastTask || !lastTask.group) return null;
  if (toTime(lastTask.start) < toTime(dayStart)) return null;
  return lastTask.group;
}

module.exports = { isInSubtree, assignMaintenanceGroups, groupUnderWay };

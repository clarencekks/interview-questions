// @ts-check
const { test, expect } = require('@playwright/test');

const testHost = '/';

test('has title', async ({ page }) => {
  await page.goto(testHost);

  // Expect a title "to contain" a substring.
  const locator = page.locator('h1');
  await expect(locator).toHaveText(/To Do List/);
});

test('clears completed tasks and persists the remaining tasks', async ({ page }) => {
  await page.goto(testHost);

  const completedTask = `Completed task ${Date.now()}`;
  const remainingTask = `Remaining task ${Date.now()}`;
  const taskInput = page.getByPlaceholder('Enter a task');

  for (const task of [completedTask, remainingTask]) {
    await taskInput.fill(task);
    await page.getByRole('button', { name: 'Add Task' }).click();
  }

  await expect(page.getByRole('button', { name: 'Clear Completed' })).toHaveCount(0);

  const completedTaskItem = page.locator('.todo-item').filter({ hasText: completedTask });
  const updateResponsePromise = page.waitForResponse(response =>
    response.url().includes('/api/todos/') && response.request().method() === 'PUT'
  );
  await completedTaskItem.getByRole('checkbox').check();
  expect((await updateResponsePromise).ok()).toBeTruthy();

  const clearCompletedButton = page.getByRole('button', { name: 'Clear Completed' });
  await expect(clearCompletedButton).toBeVisible();
  await expect(clearCompletedButton).toBeEnabled();
  await clearCompletedButton.click();

  await expect(page.getByText(completedTask)).toHaveCount(0);
  await expect(page.getByText(remainingTask)).toBeVisible();

  const apiUrl = new URL('/api/todos', page.url()).toString();
  const response = await page.request.get(apiUrl);
  expect(response.ok()).toBeTruthy();

  const todos = await response.json();
  expect(todos.some(todo => todo.task === completedTask)).toBe(false);
  expect(todos.some(todo => todo.task === remainingTask && !todo.completed)).toBe(true);

  const remainingTodo = todos.find(todo => todo.task === remainingTask);
  const cleanupResponse = await page.request.delete(new URL(`/api/todos/${remainingTodo.id}`, page.url()).toString());
  expect(cleanupResponse.ok()).toBeTruthy();
});

test('deletes a task and persists its removal', async ({ page }) => {
  await page.goto(testHost);

  const task = `Task to delete ${Date.now()}`;
  await page.getByPlaceholder('Enter a task').fill(task);
  await page.getByRole('button', { name: 'Add Task' }).click();

  const taskItem = page.locator('.todo-item').filter({ hasText: task });
  const deleteResponsePromise = page.waitForResponse(response =>
    response.url().includes('/api/todos/') && response.request().method() === 'DELETE'
  );
  await taskItem.getByRole('button', { name: 'Delete' }).click();
  expect((await deleteResponsePromise).ok()).toBeTruthy();
  await expect(page.getByText(task)).toHaveCount(0);

  const response = await page.request.get(new URL('/api/todos', page.url()).toString());
  expect(response.ok()).toBeTruthy();

  const todos = await response.json();
  expect(todos.some(todo => todo.task === task)).toBe(false);
});

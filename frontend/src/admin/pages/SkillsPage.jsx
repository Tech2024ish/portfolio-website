import { useState } from 'react'
import { adminApi } from '../api'
import {
  Button,
  ConfirmButton,
  LoadState,
  MoveButtons,
  PageHeader,
  Panel,
  move,
  useAction,
  useLoad,
} from '../ui'
import ProfileTabs from './ProfileTabs'

function SkillRow({ skill, index, count, onMove, onChanged, onDeleted }) {
  const [name, setName] = useState(skill.name)
  const [description, setDescription] = useState(skill.description)
  const [run, busy] = useAction()
  const dirty = name !== skill.name || description !== skill.description

  const save = async () => {
    const result = await run(
      () => adminApi.updateSkill(skill.id, { name, description }),
      `Saved ${name}`,
    )
    if (result.ok) onChanged(result.data)
  }

  return (
    <li className={`studio-skill-row ${skill.is_visible ? '' : 'is-hidden'}`}>
      <MoveButtons index={index} length={count} onMove={onMove} label={skill.name} />
      <input
        aria-label="Skill name"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        aria-label={`${skill.name} description`}
        placeholder="Short description (optional)"
        value={description}
        maxLength={300}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="studio-inline-check">
        <input
          type="checkbox"
          checked={skill.is_visible}
          onChange={async (e) => {
            const result = await run(() =>
              adminApi.updateSkill(skill.id, { is_visible: e.target.checked }),
            )
            if (result.ok) onChanged(result.data)
          }}
        />
        Public
      </label>
      <Button size="small" onClick={save} disabled={!dirty || !name.trim()} busy={busy}>
        Save
      </Button>
      <ConfirmButton
        size="small"
        confirmLabel="Delete?"
        onConfirm={async () => {
          const result = await run(() => adminApi.deleteSkill(skill.id), `Deleted ${skill.name}`)
          if (result.ok) onDeleted()
        }}
      >
        Delete
      </ConfirmButton>
    </li>
  )
}

function CategoryPanel({ category, index, count, onMoveCategory, reload, setCategory }) {
  const [newSkill, setNewSkill] = useState('')
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description)
  const [run, busy] = useAction()

  const reorderSkills = async (from, to) => {
    const skills = move(category.skills, from, to)
    setCategory({ ...category, skills })
    const result = await run(() =>
      adminApi.reorderSkills(
        category.id,
        skills.map((s) => s.id),
      ),
    )
    if (!result.ok) reload()
  }

  return (
    <Panel
      className={category.is_visible ? '' : 'is-hidden'}
      title={
        <span className="studio-row">
          <MoveButtons index={index} length={count} onMove={onMoveCategory} label={category.name} />
          {category.name}
          {!category.is_visible && <span className="studio-pill hidden">Hidden</span>}
        </span>
      }
      actions={
        <ConfirmButton
          size="small"
          confirmLabel={`Delete ${category.skills.length} skills too?`}
          onConfirm={async () => {
            const result = await run(
              () => adminApi.deleteSkillCategory(category.id),
              `Deleted ${category.name}`,
            )
            if (result.ok) reload()
          }}
        >
          Delete category
        </ConfirmButton>
      }
    >
      <div className="studio-row wrap">
        <input
          aria-label="Category name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          aria-label="Category description"
          placeholder="Description (optional)"
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="studio-inline-check">
          <input
            type="checkbox"
            checked={category.is_visible}
            onChange={async (e) => {
              const result = await run(() =>
                adminApi.updateSkillCategory(category.id, { is_visible: e.target.checked }),
              )
              if (result.ok) setCategory(result.data)
            }}
          />
          Show on site
        </label>
        <Button
          size="small"
          busy={busy}
          disabled={name === category.name && description === category.description}
          onClick={async () => {
            const result = await run(
              () => adminApi.updateSkillCategory(category.id, { name, description }),
              'Category saved',
            )
            if (result.ok) setCategory(result.data)
          }}
        >
          Save category
        </Button>
      </div>
      <ul className="studio-skill-list">
        {category.skills.map((skill, i) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            index={i}
            count={category.skills.length}
            onMove={reorderSkills}
            onChanged={(updated) =>
              setCategory({
                ...category,
                skills: category.skills.map((s) => (s.id === updated.id ? updated : s)),
              })
            }
            onDeleted={() =>
              setCategory({ ...category, skills: category.skills.filter((s) => s.id !== skill.id) })
            }
          />
        ))}
      </ul>
      <form
        className="studio-row"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!newSkill.trim()) return
          const result = await run(
            () => adminApi.createSkill({ category_id: category.id, name: newSkill.trim() }),
            `Added ${newSkill.trim()}`,
          )
          if (result.ok) {
            setCategory({ ...category, skills: [...category.skills, result.data] })
            setNewSkill('')
          }
        }}
      >
        <input
          aria-label={`New skill in ${category.name}`}
          placeholder="Add a technology, e.g. Redis"
          value={newSkill}
          maxLength={80}
          onChange={(e) => setNewSkill(e.target.value)}
        />
        <Button size="small" type="submit" disabled={!newSkill.trim()}>
          + Add skill
        </Button>
      </form>
    </Panel>
  )
}

export default function SkillsPage() {
  const state = useLoad((signal) => adminApi.skillCategories(signal))
  const [newCategory, setNewCategory] = useState('')
  const [run, busy] = useAction()

  const setCategory = (updated) =>
    state.setData((list) =>
      list.map((c) =>
        c.id === updated.id ? { ...c, ...updated, skills: updated.skills ?? c.skills } : c,
      ),
    )

  const moveCategory = async (from, to) => {
    const list = move(state.data, from, to)
    state.setData(list)
    const result = await run(() => adminApi.reorderSkillCategories(list.map((c) => c.id)))
    if (!result.ok) state.reload()
  }

  return (
    <>
      <PageHeader
        crumb="Studio / Profile & content"
        title="Skills & technologies"
        description="Group your toolkit, order it by importance, and hide anything you don't want to show."
      />
      <ProfileTabs />
      <LoadState state={state}>
        {state.data?.map((category, index) => (
          <CategoryPanel
            key={category.id}
            category={category}
            index={index}
            count={state.data.length}
            onMoveCategory={moveCategory}
            reload={state.reload}
            setCategory={setCategory}
          />
        ))}
        <Panel title="New category">
          <form
            className="studio-row"
            onSubmit={async (event) => {
              event.preventDefault()
              const result = await run(
                () => adminApi.createSkillCategory({ name: newCategory.trim() }),
                'Category added',
              )
              if (result.ok) {
                state.setData((list) => [...list, result.data])
                setNewCategory('')
              }
            }}
          >
            <input
              aria-label="New category name"
              placeholder="e.g. Cloud"
              value={newCategory}
              maxLength={80}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button type="submit" busy={busy} disabled={!newCategory.trim()}>
              + Add category
            </Button>
          </form>
        </Panel>
      </LoadState>
    </>
  )
}

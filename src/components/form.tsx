"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { Alert, buttonClass, cx } from "./ui";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const inputCls =
  "block w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-3 text-base outline-none transition placeholder:text-zinc-400 focus:border-ink disabled:bg-zinc-100";

/**
 * Formulário ligado a uma Server Action com mensagens de erro por campo.
 * `resetOnSuccess` limpa os campos; `onSuccess` permite fechar painéis.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  onSuccess,
  showSuccess = true,
}: {
  action: Action;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (s: ActionState) => void;
  showSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, { ok: false } as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const lastHandled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (!state.ok || lastHandled.current === state) return;
    lastHandled.current = state;
    if (resetOnSuccess) ref.current?.reset();
    onSuccess?.(state);
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state, resetOnSuccess, onSuccess, router]);

  return (
    <form ref={ref} action={formAction} className={cx("space-y-4", className)} noValidate>
      <FormContext state={state}>{typeof children === "function" ? children(state) : children}</FormContext>
      {state.error && <Alert>{state.error}</Alert>}
      {showSuccess && state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
    </form>
  );
}

// contexto simples para os campos encontrarem erros/valores anteriores
const Ctx = createContext<ActionState>({ ok: false });
function FormContext({ state, children }: { state: ActionState; children: ReactNode }) {
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
export function useFormState() {
  return useContext(Ctx);
}

export function Field({
  label,
  name,
  hint,
  children,
  className,
}: {
  label: string;
  name?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const state = useFormState();
  const err = name ? state.fieldErrors?.[name]?.[0] : undefined;
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-semibold text-zinc-700">{label}</span>
      {children}
      {hint && !err && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
      {err && <span className="mt-1 block text-sm font-medium text-brand">{err}</span>}
    </label>
  );
}

function useDefault(name: string | undefined, defaultValue: unknown) {
  const state = useFormState();
  if (name && state.values && !state.ok && name in state.values) return state.values[name];
  return defaultValue as string | undefined;
}

export function Input({ className, name, defaultValue, ...props }: ComponentProps<"input">) {
  const state = useFormState();
  const dv = useDefault(name, defaultValue);
  const invalid = name ? Boolean(state.fieldErrors?.[name]) : false;
  return (
    <input
      name={name}
      {...(props.value === undefined ? { defaultValue: dv } : {})}
      key={props.value !== undefined ? name : state.values && !state.ok ? `${name}-err-${dv}` : `${name}-${String(defaultValue ?? "")}`}
      aria-invalid={invalid || undefined}
      className={cx(inputCls, invalid && "border-brand", className)}
      {...props}
    />
  );
}

export function Textarea({ className, name, defaultValue, rows = 3, ...props }: ComponentProps<"textarea">) {
  const state = useFormState();
  const dv = useDefault(name, defaultValue);
  const invalid = name ? Boolean(state.fieldErrors?.[name]) : false;
  return (
    <textarea
      name={name}
      rows={rows}
      {...(props.value === undefined ? { defaultValue: dv } : {})}
      key={props.value !== undefined ? name : state.values && !state.ok ? `${name}-err-${dv}` : `${name}-${String(defaultValue ?? "")}`}
      aria-invalid={invalid || undefined}
      className={cx(inputCls, invalid && "border-brand", className)}
      {...props}
    />
  );
}

export function Select({ className, name, defaultValue, children, ...props }: ComponentProps<"select">) {
  const state = useFormState();
  const dv = useDefault(name, defaultValue);
  const invalid = name ? Boolean(state.fieldErrors?.[name]) : false;
  return (
    <select
      name={name}
      defaultValue={dv}
      key={state.values && !state.ok ? `${name}-err-${dv}` : `${name}-${String(defaultValue ?? "")}`}
      aria-invalid={invalid || undefined}
      className={cx(inputCls, "appearance-none bg-[length:16px] pr-10", invalid && "border-brand", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, name, defaultChecked, hint }: { label: ReactNode; name: string; defaultChecked?: boolean; hint?: ReactNode }) {
  const state = useFormState();
  const err = state.fieldErrors?.[name]?.[0];
  const checked = state.values && !state.ok ? state.values[name] === "on" : defaultChecked;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-zinc-200 bg-white p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        key={`${name}-${String(checked)}`}
        className="mt-0.5 size-6 shrink-0 accent-[#c80000]"
      />
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-zinc-600">{hint}</span>}
        {err && <span className="mt-1 block text-sm font-medium text-brand">{err}</span>}
      </span>
    </label>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "lg",
  className,
  pendingText = "Salvando…",
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "dark" | "outline" | "ghost" | "danger";
  size?: "md" | "lg" | "sm";
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={cx(buttonClass(variant, size), className)} {...props}>
      {pending ? pendingText : children}
    </button>
  );
}

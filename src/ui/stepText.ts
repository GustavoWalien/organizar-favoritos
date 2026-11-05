import type { NextStep } from '../core/dashboard'

const n = (count: number, one: string, many: string) => `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`

/** Título, dica e rótulo do botão de cada próximo passo, pendente ou resolvido. */
export function stepText(step: NextStep): { title: string; hint: string; action: string } {
  const c = step.count
  switch (step.id) {
    case 'duplicados':
      return step.done
        ? { title: 'Nenhum duplicado', hint: 'cada endereço aparece uma vez só', action: 'Revisar' }
        : { title: `Juntar ${n(c, 'duplicado', 'duplicados')}`, hint: 'a extensão já escolheu qual cópia fica', action: 'Revisar' }
    case 'testar-links':
      return step.done
        ? { title: 'Links testados', hint: 'o último teste completo tem menos de 30 dias', action: 'Testar' }
        : { title: 'Testar os links', hint: 'o Chrome pede permissão uma vez', action: 'Testar' }
    case 'quebrados':
      return step.done
        ? { title: 'Nenhum link quebrado', hint: 'pelo último teste', action: 'Revisar' }
        : { title: `Revisar ${n(c, 'link quebrado', 'links quebrados')}`, hint: 'responderam 404 ou 410 no último teste', action: 'Revisar' }
    case 'sem-uso':
      return step.done
        ? { title: 'Nenhum favorito sem uso', hint: 'todos foram abertos no período escolhido', action: 'Revisar' }
        : { title: `Revisar ${n(c, 'favorito sem uso', 'favoritos sem uso')}`, hint: 'não abertos no período escolhido', action: 'Revisar' }
    case 'sem-categoria':
      return step.done
        ? { title: 'Tudo em pastas', hint: 'nenhum favorito solto', action: 'Sugerir com IA' }
        : { title: `Dar pasta a ${n(c, 'favorito sem categoria', 'favoritos sem categoria')}`, hint: 'a IA sugere, você revisa e aplica', action: 'Sugerir com IA' }
    case 'backup':
      return step.done
        ? { title: 'Backup em dia', hint: 'o último tem menos de 7 dias', action: 'Fazer backup' }
        : { title: 'Fazer um backup', hint: 'o último tem mais de 7 dias, ou não existe', action: 'Fazer backup' }
  }
}
